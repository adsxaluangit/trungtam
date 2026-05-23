with open("d:\\Github\\edumaster\\edumaster-backend\\database\\backup_07042026.sql", "r", encoding="utf-16-le") as f:
    text = f.read()

# Encode the text using cp437 to get the original raw utf-8 bytes
raw_bytes = text.encode("cp437", errors="replace")

# Write those raw bytes directly into a new sql file
with open("d:\\Github\\edumaster\\edumaster-backend\\database\\backup_07042026_fixed.sql", "wb") as f:
    f.write(raw_bytes)
