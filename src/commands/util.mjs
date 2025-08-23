import { EmbedBuilder } from 'discord.js';
export function code(s){ return '`' + s + '`'; }
export function bold(s){ return `**${s}**`; }
export function successEmbed(desc){ return new EmbedBuilder().setColor(0x22c55e).setDescription(desc); }
export function errorEmbed(desc){ return new EmbedBuilder().setColor(0xef4444).setDescription(desc); }
export function infoEmbed(title, desc){ const e=new EmbedBuilder().setColor(0x3b82f6).setDescription(desc); if(title) e.setTitle(title); return e; }
export function vnNow(){ return new Date(Date.now() + (7*60*60*1000) - (new Date().getTimezoneOffset()*60*1000)); }
// Helper function to format currency consistently
export function formatCurrency(amount) {
    return `${amount.toLocaleString()} xu`;
}
