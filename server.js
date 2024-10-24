const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" })); // Handle larger base64 image sizes

// MongoDB connection string and JWT secret
const MONGO_URI =
  "mongodb+srv://deepanshumaik:malik123@cluster0.h0gcnnu.mongodb.net/malikelectronicsandfurniturehouse";
const JWT_SECRET = "myadminsecretkey";
const PORT = 5500;

// Connect to MongoDB
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Admin Schema
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const Admin = mongoose.model("Admin", adminSchema);

// Product Schema with Category, Subcategory, Image (base64), and Description
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  subcategory: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String, required: true }, // Store base64-encoded image
});

const Product = mongoose.model("Product", productSchema);

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  cart: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  purchasedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
});

const User = mongoose.model("User", userSchema);

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) return res.status(403).json({ message: "Token is required" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Admin Signup Route
app.post("/api/admin/signup", async (req, res) => {
  const { username, password, email } = req.body;
  try {
    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = new Admin({ username, password: hashedPassword, email });
    await newAdmin.save();

    res.status(201).json({ message: "Admin created" });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Admin Login Route
app.post("/api/admin/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const admin = await Admin.findOne({ username });
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid)
      return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: admin._id }, JWT_SECRET);
    res.json({ token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// User Signup Route
app.post("/api/user/signup", async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ username });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: "User created" });
  } catch (error) {
    console.error("User signup error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// User Login Route
app.post("/api/user/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, JWT_SECRET);
    res.json({ token });
  } catch (error) {
    console.error("User login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Add to Cart (Protected)
app.post("/api/user/cart", verifyToken, async (req, res) => {
  const { productId } = req.body;
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.cart.push(productId);
    await user.save();
    res.json({ message: "Product added to cart", cart: user.cart });
  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Add to Wishlist (Protected)
app.post("/api/user/wishlist", verifyToken, async (req, res) => {
  const { productId } = req.body;
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.wishlist.push(productId);
    await user.save();
    res.json({ message: "Product added to wishlist", wishlist: user.wishlist });
  } catch (error) {
    console.error("Add to wishlist error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Get Cart Products (Protected)
app.get("/api/user/cart", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate("cart");
    res.json(user.cart);
  } catch (error) {
    console.error("Get cart products error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Get Wishlist Products (Protected)
app.get("/api/user/wishlist", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate("wishlist");
    res.json(user.wishlist);
  } catch (error) {
    console.error("Get wishlist products error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Purchase Products (Protected)
app.post("/api/user/purchase", verifyToken, async (req, res) => {
  const { productId } = req.body;
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.purchasedProducts.push(productId);
    user.cart = user.cart.filter((item) => item.toString() !== productId);
    await user.save();
    res.json({
      message: "Product purchased",
      purchasedProducts: user.purchasedProducts,
    });
  } catch (error) {
    console.error("Purchase product error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Get All Purchased Products (Protected)
app.get("/api/user/purchased", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate("purchasedProducts");
    res.json(user.purchasedProducts);
  } catch (error) {
    console.error("Get purchased products error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Update User (Protected)
app.put("/api/user/update", verifyToken, async (req, res) => {
  const { username, email } = req.body;
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.username = username || user.username;
    user.email = email || user.email;
    await user.save();
    res.json({ message: "User updated" });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Delete User (Protected)
app.delete("/api/user/delete", verifyToken, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.userId);
    res.json({ message: "User deleted" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Add Product (Protected - Admin)
app.post("/api/products", verifyToken, async (req, res) => {
  const { name, price, category, subcategory, description, image } = req.body;

  try {
    const newProduct = new Product({
      name,
      price,
      category,
      subcategory,
      description,
      image, // Expecting base64 encoded image
    });

    await newProduct.save();
    res.status(201).json({ message: "Product added successfully" });
  } catch (error) {
    console.error("Product creation error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Get All Products
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Update Product (Protected - Admin)
app.put("/api/products/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { name, price, category, subcategory, description, image } = req.body;

  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        name,
        price,
        category,
        subcategory,
        description,
        image,
      },
      { new: true }
    );

    if (!updatedProduct)
      return res.status(404).json({ message: "Product not found" });

    res.json({ message: "Product updated successfully", updatedProduct });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Delete Product (Protected - Admin)
app.delete("/api/products/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const deletedProduct = await Product.findByIdAndDelete(id);
    if (!deletedProduct)
      return res.status(404).json({ message: "Product not found" });

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
