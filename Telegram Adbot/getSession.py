from telethon import TelegramClient
from telethon.sessions import StringSession

appid = input("appID: ")
apihash = input("ApiHash: ")

with TelegramClient(StringSession(), appid, apihash) as client:
    print(client.session.save())
