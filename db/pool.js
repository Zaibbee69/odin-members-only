const { Pool } = require("pg");

module.exports = new Pool({
    host: "localhost",
    user: "zaibbee",
    database: "clubhouse",
    password: "1122",
    port: "5432"
})
