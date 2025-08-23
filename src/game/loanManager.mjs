import Loan from '../models/Loan.mjs';

// Check for overdue loans and mark as defaulted
export async function checkOverdueLoans() {
    try {
        const now = new Date();
        const overdueLoans = await Loan.find({
            status: 'active',
            dueDate: { $lt: now },
            autoDefault: true
        });

        for (const loan of overdueLoans) {
            loan.status = 'defaulted';
            await loan.save();
            console.log(`📢 Loan ${loan.loanId} marked as defaulted`);
        }

        if (overdueLoans.length > 0) {
            console.log(`⚠️ ${overdueLoans.length} loans marked as defaulted`);
        }
    } catch (error) {
        console.error('Error checking overdue loans:', error);
    }
}

// Calculate loan statistics for a user
export async function getLoanStats(userId, guildId) {
    try {
        const stats = {
            totalLent: 0,
            totalBorrowed: 0,
            activeLending: 0,
            activeBorrowing: 0,
            completedLoans: 0,
            defaultedLoans: 0,
            totalInterestEarned: 0,
            totalInterestPaid: 0
        };

        // Loans where user is lender
        const lentLoans = await Loan.find({ lenderId: userId, guildId });
        for (const loan of lentLoans) {
            stats.totalLent += loan.amount;
            if (loan.status === 'active') stats.activeLending += loan.remainingAmount;
            if (loan.status === 'completed') {
                stats.completedLoans++;
                stats.totalInterestEarned += (loan.totalRepayment - loan.amount);
            }
            if (loan.status === 'defaulted') stats.defaultedLoans++;
        }

        // Loans where user is borrower
        const borrowedLoans = await Loan.find({ borrowerId: userId, guildId });
        for (const loan of borrowedLoans) {
            stats.totalBorrowed += loan.amount;
            if (loan.status === 'active') stats.activeBorrowing += loan.remainingAmount;
            if (loan.status === 'completed') {
                stats.totalInterestPaid += (loan.totalRepayment - loan.amount);
            }
        }

        return stats;
    } catch (error) {
        console.error('Error calculating loan stats:', error);
        return null;
    }
}

// Calculate credit score based on loan history
export function calculateCreditScore(stats) {
    let score = 500; // Base score

    // Positive factors
    if (stats.completedLoans > 0) score += stats.completedLoans * 10;
    if (stats.totalLent > 0) score += Math.min(stats.totalLent / 10000, 100);
    
    // Negative factors
    if (stats.defaultedLoans > 0) score -= stats.defaultedLoans * 50;
    
    // Ratio factors
    const totalLoans = stats.completedLoans + stats.defaultedLoans;
    if (totalLoans > 0) {
        const successRate = stats.completedLoans / totalLoans;
        score += (successRate - 0.5) * 200; // Bonus/penalty based on success rate
    }

    return Math.max(300, Math.min(850, Math.round(score)));
}

// Get credit rating from score
export function getCreditRating(score) {
    if (score >= 800) return { rating: 'Xuất sắc', color: '#00ff00', emoji: '🌟' };
    if (score >= 700) return { rating: 'Tốt', color: '#48dbfb', emoji: '✅' };
    if (score >= 600) return { rating: 'Khá', color: '#feca57', emoji: '🟡' };
    if (score >= 500) return { rating: 'Trung bình', color: '#ff9f43', emoji: '🟠' };
    return { rating: 'Kém', color: '#ff6b6b', emoji: '🔴' };
}

// Initialize loan checker (run every hour)
export function initLoanChecker() {
    // Check immediately
    checkOverdueLoans();
    
    // Then check every hour
    setInterval(checkOverdueLoans, 60 * 60 * 1000);
    console.log('💰 Loan checker initialized');
}

// Calculate compound interest for complex loans
export function calculateCompoundInterest(principal, rate, time, compound = 1) {
    return principal * Math.pow((1 + rate / (100 * compound)), compound * time);
}

// Generate loan agreement text
export function generateLoanAgreement(loan) {
    return `
**THỎA THUẬN CHO VAY**

🆔 **Mã hợp đồng:** ${loan.loanId}
👤 **Bên cho vay:** <@${loan.lenderId}>
👤 **Bên vay:** <@${loan.borrowerId}>

💰 **Điều khoản tài chính:**
- Số tiền vay: ${loan.amount.toLocaleString()} xu
- Lãi suất: ${loan.interestRate}% mỗi ngày
- Thời hạn: ${loan.duration} ngày
- Tổng phải trả: ${loan.totalRepayment.toLocaleString()} xu

📅 **Thời gian:**
- Ngày vay: ${loan.createdAt.toLocaleDateString('vi-VN')}
- Hạn trả: ${loan.dueDate.toLocaleDateString('vi-VN')}

⚠️ **Điều khoản:**
- Nếu quá hạn, khoản vay sẽ được đánh dấu là mặc định
- Bên vay có thể trả trước hạn mà không phí phạt
- Thỏa thuận này có hiệu lực khi được chấp nhận
    `.trim();
}