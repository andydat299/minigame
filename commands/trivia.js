const { EmbedBuilder } = require('discord.js');
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
    name: 'trivia',
    description: 'Trả lời câu hỏi vui để kiếm coins',
    async execute(message, args, client) {
        const userId = message.author.id;
        const username = message.author.username;

        // Tạo user nếu chưa có
        await Database.createUser(userId, username);

        const randomQuestion = questions[Math.floor(Math.random() * questions.length)];

        const embed = new EmbedBuilder()
            .setTitle('🧠 Câu hỏi vui!')
            .setDescription(randomQuestion.question)
            .addFields(
                { name: 'Các lựa chọn:', value: randomQuestion.options.join('\n'), inline: false }
            )
            .setColor('#9932cc')
            .setFooter({ text: 'Trả lời bằng A, B, C, hoặc D trong 15 giây!' });

        const questionMessage = await message.reply({ embeds: [embed] });

        const filter = (response) => {
            const answer = response.content.toUpperCase();
            return response.author.id === userId && ['A', 'B', 'C', 'D'].includes(answer);
        };

        const collector = message.channel.createMessageCollector({ 
            filter, 
            time: 15000,
            max: 1
        });

        collector.on('collect', async (answer) => {
            const userAnswer = answer.content.toUpperCase();
            
            if (userAnswer === randomQuestion.correct) {
                // Đúng
                const reward = 200;
                const xpGain = 20;

                await Database.updateUserBalance(userId, reward);
                await Database.updateUserXP(userId, xpGain);
                await Database.updateGameStats(userId, 'trivia', 'win');

                const correctEmbed = new EmbedBuilder()
                    .setTitle('🎉 Chính xác!')
                    .setDescription(`Đáp án đúng là **${randomQuestion.correct}. ${randomQuestion.answer}**`)
                    .addFields(
                        { name: '💰 Phần thưởng', value: `${reward} coins`, inline: true },
                        { name: '⭐ XP', value: `+${xpGain} XP`, inline: true }
                    )
                    .setColor('#00ff00');

                answer.reply({ embeds: [correctEmbed] });
            } else {
                // Sai
                await Database.updateGameStats(userId, 'trivia', 'lose');

                const wrongEmbed = new EmbedBuilder()
                    .setTitle('❌ Sai rồi!')
                    .setDescription(`Đáp án đúng là **${randomQuestion.correct}. ${randomQuestion.answer}**`)
                    .setColor('#ff0000')
                    .setFooter({ text: 'Thử lại với !trivia' });

                answer.reply({ embeds: [wrongEmbed] });
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                await Database.updateGameStats(userId, 'trivia', 'lose');

                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏰ Hết thời gian!')
                    .setDescription(`Đáp án đúng là **${randomQuestion.correct}. ${randomQuestion.answer}**`)
                    .setColor('#ff0000')
                    .setFooter({ text: 'Thử lại với !trivia' });

                questionMessage.edit({ embeds: [timeoutEmbed] });
            }
        });
    }
};