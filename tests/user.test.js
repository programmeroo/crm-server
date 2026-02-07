const fs = require('fs');
const path = require('path');

const TEST_DB_PATH = path.resolve(process.env.DATABASE_PATH);

let User;

beforeAll(() => {
  // Clear ALL project module caches to prevent stale database singleton references
  // from other test files (contacts, workspaces, app) that ran before this one
  Object.keys(require.cache).forEach(key => {
    if (key.includes('crm-server') && !key.includes('node_modules') && !key.includes('setup.js')) {
      delete require.cache[key];
    }
  });

  const { closeDb, initDb } = require('../config/database');
  User = require('../models/User');

  closeDb();
  [TEST_DB_PATH, TEST_DB_PATH + '-wal', TEST_DB_PATH + '-shm'].forEach(f => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
  initDb();
});

afterAll(() => {
  const { closeDb } = require('../config/database');
  closeDb();
  [TEST_DB_PATH, TEST_DB_PATH + '-wal', TEST_DB_PATH + '-shm'].forEach(f => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
});

describe('User Model', () => {
  test('User.create() creates a user with a hashed password', async () => {
    const user = await User.create({
      username: 'testuser',
      password: 'testpass123',
      displayName: 'Test User',
      email: 'test@example.com'
    });

    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.username).toBe('testuser');
    expect(user.display_name).toBe('Test User');
    expect(user.email).toBe('test@example.com');
    // findById should NOT return password_hash
    expect(user.password_hash).toBeUndefined();
  });

  test('User.findByUsername() returns the user with password_hash', () => {
    const user = User.findByUsername('testuser');

    expect(user).toBeDefined();
    expect(user.username).toBe('testuser');
    expect(user.password_hash).toBeDefined();
    expect(user.password_hash).not.toBe('testpass123'); // should be hashed
  });

  test('User.findById() returns user without password_hash', async () => {
    const full = User.findByUsername('testuser');
    const user = User.findById(full.id);

    expect(user).toBeDefined();
    expect(user.username).toBe('testuser');
    expect(user.password_hash).toBeUndefined();
  });

  test('User.verifyPassword() returns true for correct password', async () => {
    const user = User.findByUsername('testuser');
    const result = await User.verifyPassword('testpass123', user.password_hash);
    expect(result).toBe(true);
  });

  test('User.verifyPassword() returns false for wrong password', async () => {
    const user = User.findByUsername('testuser');
    const result = await User.verifyPassword('wrongpassword', user.password_hash);
    expect(result).toBe(false);
  });

  test('User.create() with duplicate username throws error', async () => {
    await expect(
      User.create({
        username: 'testuser',
        password: 'anotherpass',
        displayName: 'Duplicate'
      })
    ).rejects.toThrow();
  });

  test('User.getAll() returns all users without password_hash', async () => {
    await User.create({
      username: 'seconduser',
      password: 'pass456',
      displayName: 'Second User'
    });

    const users = User.getAll();
    expect(users.length).toBeGreaterThanOrEqual(2);
    users.forEach((u) => {
      expect(u.password_hash).toBeUndefined();
    });
  });

  test('User.findByUsername() returns null for non-existent user', () => {
    const user = User.findByUsername('nobody');
    expect(user).toBeNull();
  });

  test('User.findById() returns null for non-existent id', () => {
    const user = User.findById(99999);
    expect(user).toBeNull();
  });
});
