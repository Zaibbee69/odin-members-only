const path = require("node:path");
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");

const pool = require("./db/pool");



const app = express();
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(session({ secret: "cats", resave: false, saveUninitialized: false }));
app.use(passport.initialize())
app.use(passport.session());
app.use(express.urlencoded({ extended: false }));

const validateUser = [
    body("first_name").trim()
        .isAlpha().withMessage(`First name AlphaError`)
        .isLength({ min: 1, max: 10 }).withMessage(`First name LengthError`),
    body("last_name").trim()
        .isAlpha().withMessage(`Last name AlphaError`)
        .isLength({ min: 1, max: 10 }).withMessage(`Last name LengthError`),
];

// Local Strategy
passport.use(
    new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
        try {
            const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
            const user = rows[0];

            if (!user) {
                return done(null, false, { message: "Incorrect email" });
            }
            if (bcrypt.compareSync(password, user.password_hash) === false) {
                return done(null, false, { message: "Incorrect password" });
            }
            return done(null, user);
        } catch (err) {
            return done(err);
        }
    })
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const { rows } = await pool.query(
            "SELECT * FROM users WHERE id = $1",
            [id]
        );

        done(null, rows[0]);
    } catch (err) {
        done(err);
    }
});



// Main page Routes
app.get("/", (req, res) => res.render("index"));

// Login page Routes
app.get("/login", (req, res) => res.render("login", { error: null }));
app.post("/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
        if (err) {
            return next(err);
        }

        if (!user) {
            return res.status(401).render("login", { error: info?.message || "Login failed" });
        }

        req.login(user, (loginErr) => {
            if (loginErr) {
                return next(loginErr);
            }

            return res.redirect("/");
        });
    })(req, res, next);
});

// Logout page Routes
app.get("/logout", (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        res.redirect("/");
    });
});

// Sign up page Routes
app.get("/signup", (req, res) => res.render("signup"));
app.post("/signup", validateUser, async (req, res) => {
    const { first_name, last_name, email, password, confirm_password } = req.body;
    if (password !== confirm_password) {
        return res.status(400).json({ errors: [{ msg: "Passwords do not match" }] });
    }
    const password_hash = await bcrypt.hash(password, 10);
    await pool.query("INSERT INTO users (first_name, last_name, email, password_hash) VALUES ($1, $2, $3, $4)", [first_name, last_name, email, password_hash]);
    res.redirect("/login");
});

// Messages page Routes
app.get("/messages", async (req, res) => {
    const messages = await pool.query("SELECT messages.id, messages.title, messages.message, messages.created_at, users.first_name, users.last_name FROM messages JOIN users ON messages.user_id = users.id;");
    res.render("messages", { messages: messages.rows });
});
app.post("/messages", async (req, res) => {
    const { title, message } = req.body;
    await pool.query("INSERT INTO messages (title, message, user_id) VALUES ($1, $2, $3)", [title, message, req.user.id]);
    res.redirect("/messages");
});

app.listen(3000, (error) => {
    if (error) {
        throw error;
    }
    console.log("app listening on port 3000!");
});
