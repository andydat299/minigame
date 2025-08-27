const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Database = require('../database/database');

const questions = [
    {
        question: "Thủ đô của Việt Nam là gì?",
        options: ["A. Hồ Chí Minh", "B. Hà Nội", "C. Đà Nẵng", "D. Cần Thơ"],
        correct: "B",
        answer: "Hà Nội"
    },
    {
        question: "Ai là người phát hiện ra châu Mỹ?",
        options: ["A. Marco Polo", "B. Vasco da Gama", "C. Christopher Columbus", "D. Ferdinand Magellan"],
        correct: "C",
        answer: "Christopher Columbus"
    },
    {
        question: "Hành tinh nào gần Mặt trời nhất?",
        options: ["A. Sao Kim", "B. Sao Thủy", "C. Trái Đất", "D. Sao Hỏa"],
        correct: "B",
        answer: "Sao Thủy"
    },
    {
        question: "Ngôn ngữ lập trình nào được sử dụng để tạo trang web?",
        options: ["A. Python", "B. Java", "C. JavaScript", "D. C++"],
        correct: "C",
        answer: "JavaScript"
    },
    {
        question: "Ai viết tiểu thuyết 'Số đỏ'?",
        options: ["A. Nam Cao", "B. Vũ Trọng Phụng", "C. Ngô Tất Tố", "D. Thạch Lam"],
        correct: "B",
        answer: "Vũ Trọng Phụng"
    },
    {
        question: "Quốc gia nào có diện tích lớn nhất thế giới?",
        options: ["A. Canada", "B. Trung Quốc", "C. Mỹ", "D. Nga"],
        correct: "D",
        answer: "Nga"
    },
    {
        question: "1 + 1 = ?",
        options: ["A. 1", "B. 2", "C. 3", "D. 4"],
        correct: "B",
        answer: "2"
    },
    {
        question: "Ai phát minh ra bóng đèn điện?",
        options: ["A. Alexander Graham Bell", "B. Thomas Edison", "C. Nikola Tesla", "D. Benjamin Franklin"],
        correct: "B",
        answer: "Thomas Edison"
    }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trivia')
        .setDescription('Trả lời câu hỏi vui để kiếm coins')
        .addStringOption(option =>
            option.setName('answer')
                .setDescription('Chọn đáp án A, B, C, hoặc D')
                .setRequired(false)
                .addChoices(
                    { name: 'A', value: 'A' },
                    { name: 'B', value: 'B' },
                    { name: 'C', value: 'C' },
                    { name: 'D', value: 'D' }
                )),
    
    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;
        const userAnswer = interaction.options.getString('answer');

        // Tạo user nếu chưa có
        await Database.createUser(userId, username);

        const randomQuestion = questions[Math.floor(Math.random() * questions.length)];

        if (!userAnswer) {
            // Hiển thị câu hỏi
            const embed = new EmbedBuilder()
                .setTitle('🧠 Câu hỏi vui!')
                .setDescription(randomQuestion.question)
                .addFields(
                    { name: 'Các lựa chọn:', value: randomQuestion.options.join('\n'), inline: false }
                )
                .setColor('#9932cc')
                .setFooter({ text: 'Sử dụng /trivia answer:<A/B/C/D> để trả lời!' });

            // Lưu câu hỏi cho user này
            await this.saveUserQuestion(userId, randomQuestion);

            return interaction.reply({ embeds: [embed] });
        }

        // Xử lý đáp án
        const savedQuestion = await this.getUserQuestion(userId);
        
        if (!savedQuestion) {
            return interaction.reply({ 
                content: '❌ Không tìm thấy câu hỏi! Sử dụng `/trivia` để lấy câu hỏi mới.', 
                ephemeral: true 
            });
        }

        const questionData = JSON.parse(savedQuestion.question_data);
        
        if (userAnswer === questionData.correct) {
            // Đúng
            const reward = 200;
            const xpGain = 20;

            await Database.updateUserBalance(userId, reward);
            await Database.updateUserXP(userId, xpGain);
            await Database.updateGameStats(userId, 'trivia', 'win');

            const correctEmbed = new EmbedBuilder()
                .setTitle('🎉 Chính xác!')
                .setDescription(`Đáp án đúng là **${questionData.correct}. ${questionData.answer}**`)
                .addFields(
                    { name: '💰 Phần thưởng', value: `${reward} coins`, inline: true },
                    { name: '⭐ XP', value: `+${xpGain} XP`, inline: true }
                )
                .setColor('#00ff00');

            await interaction.reply({ embeds: [correctEmbed] });
        } else {
            // Sai
            await Database.updateGameStats(userId, 'trivia', 'lose');

            const wrongEmbed = new EmbedBuilder()
                .setTitle('❌ Sai rồi!')
                .setDescription(`Đáp án đúng là **${questionData.correct}. ${questionData.answer}**`)
                .setColor('#ff0000')
                .setFooter({ text: 'Thử lại với /trivia' });

            await interaction.reply({ embeds: [wrongEmbed] });
        }

        // Xóa câu hỏi đã dùng
        await this.deleteUserQuestion(userId);
    },

    async saveUserQuestion(userId, question) {
        return new Promise((resolve, reject) => {
            Database.db.run(`
                INSERT OR REPLACE INTO user_trivia_questions (user_id, question_data, created_at)
                VALUES (?, ?, datetime('now'))
            `, [userId, JSON.stringify(question)], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    },

    async getUserQuestion(userId) {
        return new Promise((resolve, reject) => {
            Database.db.get(
                'SELECT * FROM user_trivia_questions WHERE user_id = ? AND created_at > datetime("now", "-5 minutes")',
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    },

    async deleteUserQuestion(userId) {
        return new Promise((resolve, reject) => {
            Database.db.run(
                'DELETE FROM user_trivia_questions WHERE user_id = ?',
                [userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }
};