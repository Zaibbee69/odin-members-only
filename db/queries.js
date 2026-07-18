const pool = require("./pool");

async function getMessages() {

    const messages = await pool.query("SELECT messages.id, messages.title, messages.message, messages.created_at, users.first_name, users.last_name FROM messages JOIN users ON messages.user_id = users.id;")

    return messages.rows;
}

module.exports = {
    getMessages
}