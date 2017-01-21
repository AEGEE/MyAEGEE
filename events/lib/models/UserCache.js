const mongoose = require('../config/mongo');

// For each request, query the core for user data
// Cache user auth data so we don't have to query the core on each call
const userCacheSchema = mongoose.Schema({
  user: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, expires: 300, default: Date.now },
  token: { type: String, required: true, index: true },
});

const UserCache = mongoose.model('UserCache', userCacheSchema);
module.exports = UserCache;
