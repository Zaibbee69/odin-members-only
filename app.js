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
app.get("/", async (req, res) => {
    const messages = await pool.query("SELECT messages.id, messages.title, messages.message, messages.created_at, users.first_name, users.last_name FROM messages JOIN users ON messages.user_id = users.id;");
    res.render("index", { messages: messages.rows, user: req.user });
});


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
    await pool.query("INSERT INTO users (first_name, last_name, email, password_hash, is_admin) VALUES ($1, $2, $3, $4, $5)", [first_name, last_name, email, password_hash, req.body.is_admin === "true"]);
    res.redirect("/login");
});

// Message Page Routes
app.get("/message", (req, res) => {
    if (!req.user) {
        return res.redirect("/login");
    }
    res.render("message", { user: req.user });
});
app.post("/message", async (req, res) => {
    if (!req.user) {
        return res.redirect("/login");
    }
    const { title, message } = req.body;
    await pool.query("INSERT INTO messages (title, message, user_id) VALUES ($1, $2, $3)", [title, message, req.user.id]);
    res.redirect("/");
});
app.post("/message/:id/delete", async (req, res) => {
    if (!req.user) {
        return res.redirect("/login");
    }
    if (!req.user.is_admin) {
        return res.status(403).redirect("/");
    }

    const { id } = req.params;
    await pool.query("DELETE FROM messages WHERE id = $1", [id]);
    res.redirect("/");
});

// Join Club Routes
app.get("/join-club", (req, res) => {
    if (!req.user) {
        return res.redirect("/login");
    }
    res.render("join-club", { user: req.user });
});
app.post("/join-club", async (req, res) => {
    if (!req.user) {
        return res.redirect("/login");
    }
    const { secret_code } = req.body;
    if (secret_code !== "Avengers-Assemble") {
        return res.status(400).render("join-club", { user: req.user, error: "Incorrect secret code" });
    }
    await pool.query("UPDATE users SET is_member = true WHERE id = $1", [req.user.id]);
    res.redirect("/");
});


app.listen(3000, (error) => {
    if (error) {
        throw error;
    }
    console.log("app listening on port 3000!");
});
