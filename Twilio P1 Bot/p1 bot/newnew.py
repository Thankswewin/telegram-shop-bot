import os
import logging
import random
import re
import requests
from twilio.rest import Client
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

# Set up Twilio credentials
TWILIO_ACCOUNT_SID = 'ACb5c4c346e4cf91afa71736fbe4566d6d'
TWILIO_AUTH_TOKEN = 'c07e82e50c0370dc0504893d81c25d61'
TWILIO_PHONE_NUMBER = '+12138630529'

client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

logging.disable(logging.CRITICAL)

# Define bot token and authorized users
TOKEN = '7841641638:AAGwLJxBdIVpO5T_LT7IwuEBIZtVuZVkM58'
AUTHORIZED_USERS = [5157625576, 6838086952, 7385948068, 7242515573, 7345662887, 7208067825]

# Initialize application
application = Application.builder().token(TOKEN).build()

user_states = {}
used_lines = set()

# Load used lines from file
def load_used_lines():
    if os.path.exists('used_lines.txt'):
        with open('used_lines.txt', 'r') as f:
            return set(line.strip() for line in f.readlines())
    return set()

# Save used lines to file
def save_used_lines():
    with open('used_lines.txt', 'w') as f:
        for line in used_lines:
            f.write(f"{line}\n")

used_lines = load_used_lines()  # Load used lines on startup

def is_authorized(user_id: int) -> bool:
    return user_id in AUTHORIZED_USERS

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.message.from_user.id
    if not is_authorized(user_id):
        await update.message.reply_text('You are not authorized to use this bot.')
        return
    await update.message.reply_text('Welcome to Star p1. Use /help to get started.')

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.message.from_user.id
    if not is_authorized(user_id):
        await update.message.reply_text('You are not authorized to use this command.')
        return

    help_text = (
        "• Available commands:\n"
        "• /start - Receive a welcome message.\n"
        "• /call - Begin the process for pressing 1 calls.\n"
        "• /line - Retrieve a line from the log where recipients pressed '1'. \n"
        "• Upload a file named `lines.txt` with format: email | name | number."
    )
    await update.message.reply_text(help_text)

async def call(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.message.from_user.id
    if not is_authorized(user_id):
        await update.message.reply_text('You are not authorized to use this command.')
        return
    user_states[user_id] = 'awaiting_file'  # Set the state to waiting for a file
    await update.message.reply_text('Please upload a file named `lines.txt` to load numbers.', parse_mode='Markdown')

async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.message.from_user.id
    if not is_authorized(user_id):
        await update.message.reply_text('You are not authorized to upload files.')
        return

    if user_id in user_states and user_states[user_id] == 'awaiting_file':
        document = update.message.document
        if document.file_name == 'lines.txt':
            try:
                file = await document.get_file()
                file_content = await file.download_as_bytearray()
                lines = file_content.decode('utf-8').splitlines()

                if not lines:
                    await update.message.reply_text('The file you uploaded is empty. Please upload a valid file.')
                    return

                # Process each line and call the numbers
                for line in lines:
                    try:
                        parts = line.split('|')
                        if len(parts) >= 3:  # Ensure there are enough parts
                            email = parts[0].strip()
                            name = parts[1].strip()
                            phone_number = parts[2].strip()  # Assuming phone number is in the third part

                            # Format the phone number
                            formatted_number = format_phone_number(phone_number)
                            make_call(formatted_number)

                            await update.message.reply_text(f'Call initiated to {name} at {formatted_number}.')
                        else:
                            await update.message.reply_text('Invalid format in lines.txt. Each line should be: email | name | number.')
                            continue
                    except Exception as e:
                        print(f"Error processing line '{line}': {e}")
                        await update.message.reply_text(f'Error processing line: {line}')

                await update.message.reply_text('All calls have been initiated.')
            except Exception as e:
                print(f"Error processing file: {e}")
                await update.message.reply_text('Failed to process the file. Please try again with a valid text file.')
        else:
            await update.message.reply_text('Please upload a file named `lines.txt`.', parse_mode='Markdown')
        user_states[user_id] = None  # Reset state after handling

def format_phone_number(raw_number):
    digits = re.sub(r'\D', '', raw_number)
    if len(digits) == 10:
        return f'+1{digits}'
    elif len(digits) == 11 and digits.startswith('1'):
        return f'+{digits}'
    else:
        raise ValueError("Invalid phone number format.")

def make_call(to_number):
    call = client.calls.create(
        to=to_number,
        from_=TWILIO_PHONE_NUMBER,
        url='https://7c58-2a05-b0c7-6af7-00-1.ngrok-free.app/voice',  # Use your ngrok URL here
        method='POST'
    )
    print(f"Call initiated: {call.sid}")

async def line(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.message.from_user.id
    if not is_authorized(user_id):
        await update.message.reply_text('You are not authorized to use this command.')
        return

    try:
        with open('/root/dmtf/call_log.txt', 'r') as f:
            lines = [line.strip() for line in f.readlines() if "pressed: 1" in line and line.strip() not in used_lines]
        
        if not lines:
            await update.message.reply_text('No more lines available in the database.')
            return

        # Randomly select a line that hasn't been used yet
        line_to_return = random.choice(lines)
        used_lines.add(line_to_return)  # Mark this line as used
        save_used_lines()  # Save the updated set of used lines
        await update.message.reply_text(line_to_return)
    except Exception as e:
        print(f"Error reading call_log.txt: {e}")
        await update.message.reply_text(' Error retrieving lines.')

async def error(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    logger = logging.getLogger(__name__)
    logger.warning(f'Update "{update}" caused error "{context.error}"')

def main() -> None:
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("call", call))
    application.add_handler(MessageHandler(filters.Document.ALL, handle_document))
    application.add_handler(CommandHandler("line", line))
    application.add_handler(CommandHandler("help", help_command))
    application.add_error_handler(error)

    application.run_polling()

if __name__ == '__main__':
    main()
