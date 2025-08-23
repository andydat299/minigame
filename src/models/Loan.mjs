import mongoose from 'mongoose';

const loanSchema = new mongoose.Schema({
  loanId: { type: String, required: true, unique: true },
  lenderId: { type: String, required: true }, // Người cho vay
  borrowerId: { type: String, required: true }, // Người vay
  guildId: { type: String, required: true },
  
  amount: { type: Number, required: true }, // Số tiền vay
  interestRate: { type: Number, required: true }, // Lãi suất % mỗi ngày
  duration: { type: Number, required: true }, // Thời hạn (ngày)
  
  totalRepayment: { type: Number, required: true }, // Tổng số tiền phải trả
  paidAmount: { type: Number, default: 0 }, // Số tiền đã trả
  remainingAmount: { type: Number, required: true }, // Số tiền còn lại
  
  status: { 
    type: String, 
    enum: ['pending', 'active', 'completed', 'defaulted', 'cancelled'], 
    default: 'pending' 
  },
  
  createdAt: { type: Date, default: Date.now },
  approvedAt: { type: Date },
  dueDate: { type: Date },
  completedAt: { type: Date },
  
  // Payment history
  payments: [{
    amount: Number,
    timestamp: { type: Date, default: Date.now },
    note: String
  }],
  
  // Loan terms
  collateral: { type: String }, // Tài sản thế chấp (optional)
  terms: { type: String }, // Điều khoản đặc biệt
  autoDefault: { type: Boolean, default: true } // Tự động default khi quá hạn
}, { timestamps: true });

loanSchema.index({ lenderId: 1, guildId: 1 });
loanSchema.index({ borrowerId: 1, guildId: 1 });
loanSchema.index({ status: 1 });

export default mongoose.model('Loan', loanSchema);