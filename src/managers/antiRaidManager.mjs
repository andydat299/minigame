import AntiRaid from '../models/AntiRaid.mjs';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';

class AntiRaidManager {
  constructor(client) {
    this.client = client;
    this.joinTracker = new Map(); // guildId -> Array of join timestamps
    this.messageTracker = new Map(); // userId -> Array of message timestamps
    this.lockdownChannels = new Set(); // Set of locked channel IDs
  }

  // Initialize antiraid for a guild
  async initializeGuild(guildId) {
    try {
      let antiRaid = await AntiRaid.findOne({ guildId });
      if (!antiRaid) {
        antiRaid = new AntiRaid({ guildId });
        await antiRaid.save();
      }
      return antiRaid;
    } catch (error) {
      console.error('Error initializing antiraid:', error);
      return null;
    }
  }

  // Check for join spam
  async checkJoinSpam(member) {
    try {
      const guildId = member.guild.id;
      const antiRaid = await AntiRaid.findOne({ guildId });
      
      if (!antiRaid?.isEnabled) return false;

      const now = Date.now();
      if (!this.joinTracker.has(guildId)) {
        this.joinTracker.set(guildId, []);
      }

      const joins = this.joinTracker.get(guildId);
      joins.push(now);

      // Remove joins older than 1 minute
      const oneMinuteAgo = now - 60000;
      const recentJoins = joins.filter(time => time > oneMinuteAgo);
      this.joinTracker.set(guildId, recentJoins);

      // Check if exceeded limit
      if (recentJoins.length > antiRaid.settings.maxJoinsPerMinute) {
        await this.handleRaidDetected(member.guild, 'join_spam', {
          joinCount: recentJoins.length,
          timeframe: '1 minute'
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking join spam:', error);
      return false;
    }
  }

  // Check for message spam
  async checkMessageSpam(message) {
    try {
      if (message.author.bot) return false;

      const guildId = message.guild.id;
      const userId = message.author.id;
      const antiRaid = await AntiRaid.findOne({ guildId });
      
      if (!antiRaid?.isEnabled) return false;

      // Check if user is whitelisted
      if (this.isWhitelisted(message.member, antiRaid)) return false;

      const now = Date.now();
      const userKey = `${guildId}-${userId}`;
      
      if (!this.messageTracker.has(userKey)) {
        this.messageTracker.set(userKey, []);
      }

      const messages = this.messageTracker.get(userKey);
      messages.push(now);

      // Remove messages older than 1 minute
      const oneMinuteAgo = now - 60000;
      const recentMessages = messages.filter(time => time > oneMinuteAgo);
      this.messageTracker.set(userKey, recentMessages);

      // Check message spam
      if (recentMessages.length > antiRaid.settings.maxMessagesPerMinute) {
        await this.handleSpamUser(message, 'message_spam');
        return true;
      }

      // Check mention spam
      const mentions = message.mentions.users.size + message.mentions.roles.size;
      if (mentions > antiRaid.settings.maxMentionsPerMessage) {
        await this.handleSpamUser(message, 'mention_spam');
        return true;
      }

      // Check for suspicious links
      if (await this.checkSuspiciousLinks(message, antiRaid)) {
        await this.handleSpamUser(message, 'link_spam');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking message spam:', error);
      return false;
    }
  }

  // Check for suspicious links
  async checkSuspiciousLinks(message, antiRaid) {
    const linkRegex = /(https?:\/\/[^\s]+)/gi;
    const links = message.content.match(linkRegex);
    
    if (!links) return false;

    for (const link of links) {
      try {
        const url = new URL(link);
        const domain = url.hostname.toLowerCase();
        
        // Check if domain is trusted
        const isTrusted = antiRaid.settings.trustedDomains.some(trusted => 
          domain.includes(trusted.toLowerCase())
        );
        
        if (!isTrusted) {
          return true;
        }
      } catch (error) {
        // Invalid URL, consider suspicious
        return true;
      }
    }

    return false;
  }

  // Check if user is whitelisted
  isWhitelisted(member, antiRaid) {
    if (!member) return false;

    // Check whitelisted users
    if (antiRaid.settings.whitelistedUsers.includes(member.id)) {
      return true;
    }

    // Check whitelisted roles
    const hasWhitelistedRole = member.roles.cache.some(role => 
      antiRaid.settings.whitelistedRoles.includes(role.id)
    );

    // Check if user has manage messages permission
    const hasManagePermission = member.permissions.has(PermissionFlagsBits.ManageMessages);

    return hasWhitelistedRole || hasManagePermission;
  }

  // Handle raid detected
  async handleRaidDetected(guild, type, data) {
    try {
      const antiRaid = await AntiRaid.findOne({ guildId: guild.id });
      if (!antiRaid) return;

      // Update statistics
      antiRaid.statistics.totalRaidsDetected++;
      antiRaid.statistics.lastRaidAt = new Date();

      // Add log entry
      antiRaid.logs.push({
        type,
        reason: 'Raid detected',
        timestamp: new Date(),
        data
      });

      await antiRaid.save();

      // Trigger lockdown
      await this.triggerLockdown(guild, antiRaid);

      // Send alert
      await this.sendAlert(guild, antiRaid, {
        type: 'raid_detected',
        details: data
      });

    } catch (error) {
      console.error('Error handling raid:', error);
    }
  }

  // Handle individual spam user
  async handleSpamUser(message, type) {
    try {
      const antiRaid = await AntiRaid.findOne({ guildId: message.guild.id });
      if (!antiRaid) return;

      // Delete message if enabled
      if (antiRaid.settings.deleteSpamMessages) {
        try {
          await message.delete();
          antiRaid.statistics.totalMessagesDeleted++;
        } catch (error) {
          console.log('Could not delete message:', error.message);
        }
      }

      // Kick user if enabled
      if (antiRaid.settings.autoKickSuspicious) {
        try {
          await message.member.kick(`AntiRaid: ${type}`);
          antiRaid.statistics.totalUsersKicked++;
        } catch (error) {
          console.log('Could not kick user:', error.message);
        }
      }

      // Ban user if enabled
      if (antiRaid.settings.autoBanRaiders) {
        try {
          await message.member.ban({ reason: `AntiRaid: ${type}` });
          antiRaid.statistics.totalUsersBanned++;
        } catch (error) {
          console.log('Could not ban user:', error.message);
        }
      }

      // Add log entry
      antiRaid.logs.push({
        type,
        userId: message.author.id,
        username: message.author.tag,
        reason: 'Spam detected',
        timestamp: new Date(),
        data: {
          messageContent: message.content.substring(0, 100),
          channelId: message.channel.id
        }
      });

      await antiRaid.save();

      // Send alert
      await this.sendAlert(message.guild, antiRaid, {
        type: 'user_action',
        user: message.author,
        action: type
      });

    } catch (error) {
      console.error('Error handling spam user:', error);
    }
  }

  // Trigger server lockdown
  async triggerLockdown(guild, antiRaid) {
    try {
      const channels = guild.channels.cache.filter(channel => 
        channel.isTextBased() && !this.lockdownChannels.has(channel.id)
      );

      for (const [, channel] of channels) {
        try {
          await channel.permissionOverwrites.create(guild.roles.everyone, {
            SendMessages: false,
            AddReactions: false,
            Connect: false,
            Speak: false
          });
          
          this.lockdownChannels.add(channel.id);
        } catch (error) {
          console.log(`Could not lock channel ${channel.name}:`, error.message);
        }
      }

      // Auto unlock after duration
      setTimeout(async () => {
        await this.unlockGuild(guild);
      }, antiRaid.settings.lockdownDuration * 1000);

      await this.sendAlert(guild, antiRaid, {
        type: 'lockdown_activated',
        duration: antiRaid.settings.lockdownDuration
      });

    } catch (error) {
      console.error('Error triggering lockdown:', error);
    }
  }

  // Unlock guild
  async unlockGuild(guild) {
    try {
      const channels = guild.channels.cache.filter(channel => 
        this.lockdownChannels.has(channel.id)
      );

      for (const [, channel] of channels) {
        try {
          await channel.permissionOverwrites.delete(guild.roles.everyone);
          this.lockdownChannels.delete(channel.id);
        } catch (error) {
          console.log(`Could not unlock channel ${channel.name}:`, error.message);
        }
      }

      const antiRaid = await AntiRaid.findOne({ guildId: guild.id });
      if (antiRaid) {
        await this.sendAlert(guild, antiRaid, {
          type: 'lockdown_deactivated'
        });
      }

    } catch (error) {
      console.error('Error unlocking guild:', error);
    }
  }

  // Send alert to designated channel
  async sendAlert(guild, antiRaid, alertData) {
    try {
      if (!antiRaid.settings.alertChannel) return;

      const channel = guild.channels.cache.get(antiRaid.settings.alertChannel);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setColor('#ff4757')
        .setTitle('🛡️ AntiRaid Alert')
        .setTimestamp();

      switch (alertData.type) {
        case 'raid_detected':
          embed.setDescription(`🚨 **Raid detected!**\nType: ${alertData.details.type || 'Unknown'}`);
          embed.addFields([
            {
              name: '📊 Details',
              value: JSON.stringify(alertData.details, null, 2).substring(0, 1000),
              inline: false
            }
          ]);
          break;

        case 'user_action':
          embed.setDescription(`⚠️ **Action taken against user**`);
          embed.addFields([
            {
              name: '👤 User',
              value: `${alertData.user.tag} (${alertData.user.id})`,
              inline: true
            },
            {
              name: '🎯 Action',
              value: alertData.action,
              inline: true
            }
          ]);
          break;

        case 'lockdown_activated':
          embed.setDescription(`🔒 **Server lockdown activated**\nDuration: ${alertData.duration} seconds`);
          break;

        case 'lockdown_deactivated':
          embed.setDescription(`🔓 **Server lockdown deactivated**`);
          embed.setColor('#2ed573');
          break;
      }

      await channel.send({ embeds: [embed] });

    } catch (error) {
      console.error('Error sending alert:', error);
    }
  }

  // Get antiraid statistics
  async getStatistics(guildId) {
    try {
      const antiRaid = await AntiRaid.findOne({ guildId });
      return antiRaid?.statistics || null;
    } catch (error) {
      console.error('Error getting statistics:', error);
      return null;
    }
  }
}

export default AntiRaidManager;