import bcrypt
print("Bcrypt imported.")
hashed = bcrypt.hashpw(b"test", bcrypt.gensalt())
print("Bcrypt hashpw success.")
verified = bcrypt.checkpw(b"test", hashed)
print("Bcrypt checkpw success:", verified)

from backend.app.db.mongo import get_database
print("Connecting to MongoDB...")
db = get_database()
print("MongoDB connected successfully. Collections:", db.list_collection_names())
