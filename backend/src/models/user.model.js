const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")

const userSchema = new mongoose.Schema({
    email: {
        type: String, required: [true, "Email is required"], trim: true, lowercase: true, unique: true,
        match: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Invalid email address"]
    },
    name: { type: String, required: [true, "Name is required"], trim: true, maxlength: 80 },
    password: { type: String, required: true, minlength: [8, "Password must be at least 8 characters"], select: false },
    statementFrequency: { type: String, enum: ["OFF", "WEEKLY", "MONTHLY"], default: "OFF" },
    statementsSince: Date,
    systemUser: { type: Boolean, default: false, immutable: true, select: false }
}, { timestamps: true })

userSchema.pre("save", async function () {
    if (!this.isModified("password")) return
    this.password = await bcrypt.hash(this.password, 12)
})

userSchema.methods.comparePassword = function (plain) {
    return bcrypt.compare(plain, this.password)
}

module.exports = mongoose.model("user", userSchema)
