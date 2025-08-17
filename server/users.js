// server/users.js

// temporary in-memory user storage
// later, we'll replace this with a real DB
const users = [];

// function to add a new user
function addUser(email, passwordHash) {
  users.push({ email, passwordHash });
}

// function to find user by email
function findUserByEmail(email) {
  return users.find(user => user.email === email);
}

module.exports = {
  addUser,
  findUserByEmail
};
