const readline = require("readline/promises");
const bcrypt = require("bcryptjs");
const { stdin: input, stdout: output } = require("process");
const { db } = require("../server/database");

async function main() {
  let username = process.env.ADMIN_USER || "";
  let password = process.env.ADMIN_PASS || "";

  if (!username || !password) {
    const rl = readline.createInterface({ input, output });
    try {
      if (!username) {
        username = (await rl.question("管理员用户名 [admin]: ")).trim() || "admin";
      }
      if (!password) {
        password = await rl.question("管理员密码 (至少6位, 输入时可见): ");
      }
    } finally {
      rl.close();
    }
  }

  if (!username || !password || password.length < 6) {
    console.error("用户名不能为空, 密码至少 6 位");
    process.exitCode = 1;
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  const existing = db.prepare("SELECT id FROM users WHERE username=?").get(username);
  if (existing) {
    db.prepare("UPDATE users SET password=?, is_admin=1 WHERE username=?").run(hash, username);
    console.log("管理员密码已重置: " + username);
  } else {
    db.prepare("INSERT INTO users (username,password,nickname,is_admin) VALUES (?,?,?,1)")
      .run(username, hash, username);
    console.log("管理员已创建: " + username);
  }

  const admin = db.prepare("SELECT id FROM users WHERE username=?").get(username);
  const defCh = db.prepare("SELECT id FROM channels WHERE is_default=1").get();
  if (admin && defCh) {
    db.prepare("INSERT OR IGNORE INTO channel_members (channel_id,user_id,role) VALUES (?,?,?)")
      .run(defCh.id, admin.id, "owner");
  }
}

main()
  .catch(err => {
    console.error(err && err.message ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.close());
