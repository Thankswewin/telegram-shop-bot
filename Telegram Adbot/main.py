import asyncio
import json
import time
from telethon import TelegramClient
from telethon.tl.functions.messages import ForwardMessagesRequest
from telethon.tl.functions.channels import JoinChannelRequest
from telethon.sessions import StringSession

menu_items = [
    'Mass Group Joiner',
    'Message forwarder',
    'Message Bot',
]

def display_menu():
    send_msg = '''Telegram Ad Bot\n\n'''
    for item in menu_items:
        send_msg += f"[{menu_items.index(item) + 1}] {item}\n"
    send_msg += f"[{len(menu_items) + 1}] Exit\n"
    return send_msg

async def start_bot(opt):
    conf = json.loads(open("resources/config.json").read())
    channels = [line.strip() for line in open("resources/groups.txt").readlines()]
    tasks = []
    active_bots = []

    for bot_conf in conf['bots']:
        client = TelegramClient(StringSession(bot_conf['sessionKey']), bot_conf['appId'], bot_conf['appHash'])
        await client.start()

        tgBot = TelegramBot(conf, bot_conf, channels, client=client)
        active_bots.append(tgBot)

        if opt == 1:
            tasks.append(tgBot.mass_join_channel())
        elif opt == 2:
            tasks.append(tgBot.forward_messages_continue())
        elif opt == 3:
            tasks.append(tgBot.send_group_messages())
        
    await asyncio.gather(*tasks)

def get_message(file):
    return open(f"resources/{file}.txt", "r").read()

class TelegramBot:
    def __init__(self, config, bot, channels, client):
        self.channelsToSend = channels
        self.client = client
        self.count = 0
        self.name = bot['name']
        self.interval = config['interval']
        self.cooldown = config['intervalBetweenLoops']
        self.messagesToForward = config['messagesToForward']

    async def mass_join_channel(self):
        for chan in self.channelsToSend:
            self.count += 1
            newChan = chan.split('/')[-1]
            try:
                await self.client(JoinChannelRequest(newChan))      
                chan = chan.replace("\n", "")
                print(f"[{self.count}] | [{self.name}] JOINED [{chan}]") 
            except:
                print(f"[{self.count}] | [{self.name}] FAILED TO JOIN [{chan}]")
            time.sleep(self.interval)

        self.client.disconnect()
    
    async def forward_message(self, client, msg, recv):
        msg = msg.rsplit("/", 1)        
        return await client(ForwardMessagesRequest(from_peer=msg[0], id=[int(msg[1])], to_peer=recv))    
    
    async def forward_messages_continue(self):
        while True:
            for msg in self.messagesToForward:
                for chan in self.channelsToSend:
                    self.count += 1
                    chanDisplay = chan.replace("\n", "").split("/")[-1]
                    try:
                        await self.forward_message(self.client, msg, chan)
                        print(f"[{self.count}] | [{self.name}] FORWARDED => {msg} TO {chanDisplay}")
                    except:
                        print(f"[{self.count}] | [{self.name}] FAILED TO FORWARD TO [{chanDisplay}] | NOT IN GROUP")

                    time.sleep(self.interval)
            
            self.count += 1
            print(f"[{self.count}] | [{self.name}] ON FORWARDING COOLDOWN [{self.cooldown} SEC]")
            time.sleep(self.cooldown)

    async def send_group_messages(self):
        msgToSend = get_message("message").replace("\n", "")
        while True:
            for chat in self.channelsToSend:
                self.count += 1
                try:
                    await self.client.send_message(entity=await self.client.get_entity(chat), message=msgToSend)
                    chat = chat.replace("\n", "")
                    print(f"[{self.count}] | [{self.name}] SENT => \"{msgToSend}\" to {chat}")
                
                except:
                    print(f"[{self.count}] | [{self.name}] FAILED TO SEND MSG TO GROUP | NOT IN GROUP")

                time.sleep(self.interval)
            time.sleep(self.cooldown)
    
if __name__ == '__main__':
    print(display_menu())
    optionSelect = int(input("Option: "))
    if 1 <= optionSelect <= len(menu_items):
        asyncio.run(start_bot(optionSelect))
