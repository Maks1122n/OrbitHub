// MongoDB initialization script
db = db.getSiblingDB('orbithub');

// Create collections with validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['username', 'email', 'password'],
      properties: {
        username: {
          bsonType: 'string',
          minLength: 3,
          maxLength: 30
        },
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        },
        password: {
          bsonType: 'string',
          minLength: 6
        },
        role: {
          bsonType: 'string',
          enum: ['admin', 'user']
        },
        isActive: {
          bsonType: 'bool'
        }
      }
    }
  }
});

db.createCollection('accounts', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['username', 'password', 'dropboxFolder', 'defaultCaption'],
      properties: {
        username: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._]{1,30}$'
        },
        password: {
          bsonType: 'string'
        },
        status: {
          bsonType: 'string',
          enum: ['active', 'inactive', 'banned', 'error']
        },
        maxPostsPerDay: {
          bsonType: 'number',
          minimum: 1,
          maximum: 20
        }
      }
    }
  }
});

db.createCollection('posts', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['accountId', 'videoFileName', 'caption'],
      properties: {
        status: {
          bsonType: 'string',
          enum: ['pending', 'publishing', 'published', 'failed']
        },
        caption: {
          bsonType: 'string',
          maxLength: 2200
        }
      }
    }
  }
});

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });

db.accounts.createIndex({ username: 1 }, { unique: true });
db.accounts.createIndex({ status: 1 });
db.accounts.createIndex({ isRunning: 1 });
db.accounts.createIndex({ adsPowerProfileId: 1 });

db.posts.createIndex({ accountId: 1 });
db.posts.createIndex({ status: 1 });
db.posts.createIndex({ publishedAt: 1 });
db.posts.createIndex({ accountId: 1, status: 1 });
db.posts.createIndex({ accountId: 1, createdAt: -1 });

print('MongoDB initialization completed successfully!'); 