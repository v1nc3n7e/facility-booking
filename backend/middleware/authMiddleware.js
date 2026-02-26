const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "bookspace_secret_key";

exports.authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ success: false, error: "No token provided." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, error: "Invalid or expired token." });
  }
};

exports.requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ success: false, error: "Admin access required." });
  }
  next();
};
