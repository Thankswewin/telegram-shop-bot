/**
 * @fileoverview XMTP Messenger - A secure messaging interface for Coinbase Wallet users
 * through Telegram. Enables end-to-end encrypted communication using XMTP protocol.
 * @author @suite
 */

import { Client } from "@xmtp/xmtp-js";
import { Wallet, JsonRpcProvider } from "ethers";
import { Telegraf, Markup } from "telegraf";
import fs from "fs/promises";

class XMTPMessenger {
  static WALLET_PATH = "./wallet.json";
  static INFURA_URL =
    "https://mainnet.infura.io/v3/7c0872b317584e789dc454365282fc27";
  static TELEGRAM_TOKEN = "TELEGRAM_TOKEN"; // Replace with actual bot token

  /**
   * Initialize messenger instance with required clients and state
   */
  constructor() {
    this.client = null;
    this.wallet = null;
    this.provider = new JsonRpcProvider(XMTPMessenger.INFURA_URL);
    this.bot = new Telegraf(XMTPMessenger.TELEGRAM_TOKEN);
    this.activeMessages = new Map();
  }

  /**
   * Initialize the messenger by loading wallet and setting up services
   * @returns {Promise<XMTPMessenger>} Initialized messenger instance
   */
  async initialize() {
    try {
      this.wallet = await this.loadOrCreateWallet();
      this.client = await Client.create(this.wallet, { env: "production" });
      this.setupTelegramBot();
      return this;
    } catch (error) {
      console.error("Initialization failed:", error.message);
      throw error;
    }
  }

  /**
   * Load existing wallet or create new one if none exists
   * @returns {Promise<Wallet>} Ethereum wallet instance
   */
  async loadOrCreateWallet() {
    try {
      const walletData = await fs.readFile(XMTPMessenger.WALLET_PATH, "utf8");
      return new Wallet(JSON.parse(walletData).privateKey);
    } catch {
      const wallet = Wallet.createRandom();
      await fs.writeFile(
        XMTPMessenger.WALLET_PATH,
        JSON.stringify(
          {
            address: wallet.address,
            privateKey: wallet.privateKey,
          },
          null,
          2
        )
      );
      return wallet;
    }
  }

  /**
   * Format message preview with timestamp and branding
   * @param {string} message - Raw message content
   * @returns {string} Formatted message preview
   */
  formatPreview(message) {
    const time = new Date().toLocaleString("en-US", {
      timeZone: "UTC",
      hour: "numeric",
      minute: "numeric",
      hour12: true,
      month: "short",
      day: "numeric",
    });

    return `${message.trim()}

• Sent via Coinbase Wallet
• ${time} UTC
• @suite`;
  }

  /**
   * Resolve various address formats to Ethereum addresses
   * @param {string} recipient - Address input (.cb.id, .eth, or 0x address)
   * @returns {Promise<Object>} Resolved address information
   */
  async resolveAddress(recipient) {
    if (this.isValidEthereumAddress(recipient)) {
      return { address: recipient, resolved: false };
    }

    if (recipient.endsWith(".cb.id") || recipient.endsWith(".eth")) {
      const address = await this.provider.resolveName(recipient);
      if (!address) throw new Error(`Unable to resolve ${recipient}`);
      return { address, resolved: true, original: recipient };
    }

    throw new Error("Please enter a valid Coinbase ID or ETH address");
  }

  /**
   * Configure Telegram bot commands and message handlers
   */
  setupTelegramBot() {
    this.bot.command("start", (ctx) => {
      ctx.reply(
        "⚡️ COINBASE WALLET PROMPTER\n\n" +
          "○ /prompt — New prompt\n" +
          "○ /help — Commands\n\n" +
          "• Secure messaging\n" +
          "• @suite"
      );
    });

    this.bot.command("help", (ctx) => {
      ctx.reply(
        "⚡️ COINBASE WALLET PROMPTER\n\n" +
          "○ /prompt — Send a new prompt\n" +
          "○ /start — Return to main menu\n" +
          "○ /help — Command list\n\n" +
          "• End-to-end encrypted\n" +
          "• Coinbase Wallet integration\n" +
          "• @suite"
      );
    });

    this.bot.command(["prompt", "send", "compose"], async (ctx) => {
      const msg = await ctx.reply(
        "⚡️ NEW COINBASE WALLET PROMPT\n\n" +
          "○ Enter recipient's Coinbase ID (.cb.id) or ETH address\n\n" +
          "• Supports .cb.id and .eth addresses\n" +
          "• Secure end-to-end delivery",
        Markup.forceReply()
      );
      this.activeMessages.set(ctx.chat.id, {
        step: "recipient",
        messageIds: [msg.message_id],
      });
    });

    // Text message handler for multi-step message composition
    this.bot.on("text", async (ctx) => {
      const active = this.activeMessages.get(ctx.chat.id);
      if (!active) return;

      try {
        if (active.step === "recipient") {
          await this.handleRecipientStep(ctx, active);
        } else if (active.step === "composition") {
          await this.handleCompositionStep(ctx, active);
        }
      } catch (error) {
        await ctx.reply(`❌ Error: ${error.message}`);
        this.activeMessages.delete(ctx.chat.id);
      }
    });

    // Action handlers for message preview buttons
    this.setupActionHandlers();

    // Launch bot and setup graceful shutdown
    this.bot.launch();
    console.log("⚡️ Messenger active");

    process.once("SIGINT", () => this.bot.stop("SIGINT"));
    process.once("SIGTERM", () => this.bot.stop("SIGTERM"));
  }

  /**
   * Handle recipient input step
   * @private
   */
  async handleRecipientStep(ctx, active) {
    const loadingMsg = await ctx.reply("⚡️ Resolving address...");

    try {
      const resolved = await this.resolveAddress(ctx.message.text);
      active.recipient = resolved;
      active.step = "composition";

      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
      const recipientInfo = resolved.resolved
        ? `${resolved.original}\n${resolved.address}`
        : resolved.address;

      const msg = await ctx.reply(
        "⚡️ RECIPIENT CONFIRMED\n\n" +
          `TO:\n${recipientInfo}\n\n` +
          "○ Enter your prompt message:",
        Markup.keyboard([["Cancel"]])
          .oneTime()
          .resize()
      );
      active.messageIds.push(msg.message_id);
    } catch (error) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        loadingMsg.message_id,
        null,
        `❌ Error: ${error.message}\n\nPlease try again with a valid address`
      );
      this.activeMessages.delete(ctx.chat.id);
    }
  }

  /**
   * Handle message composition step
   * @private
   */
  async handleCompositionStep(ctx, active) {
    if (ctx.message.text === "Cancel") {
      this.activeMessages.delete(ctx.chat.id);
      await ctx.reply("○ Prompt cancelled", Markup.removeKeyboard());
      return;
    }

    active.message = ctx.message.text;
    const preview = this.formatPreview(active.message);
    const recipientInfo = active.recipient.resolved
      ? `${active.recipient.original}\n${active.recipient.address}`
      : active.recipient.address;

    const msg = await ctx.reply(
      "⚡️ PREVIEW\n\n" + `TO:\n${recipientInfo}\n\n${preview}`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback("⚡️ Send", "send"),
          Markup.button.callback("✎ Edit", "edit"),
        ],
        [Markup.button.callback("○ Cancel", "cancel")],
      ])
    );
    active.messageIds.push(msg.message_id);
    active.step = "preview";
  }

  /**
   * Setup handlers for inline keyboard actions
   * @private
   */
  setupActionHandlers() {
    this.bot.action("send", async (ctx) => {
      const active = this.activeMessages.get(ctx.chat.id);
      if (!active) return;

      try {
        await ctx.editMessageText("⚡️ Connecting to secure network...");
        await this.sendMessage(active.recipient.address, active.message);

        const recipientInfo = active.recipient.resolved
          ? `${active.recipient.original}\n${active.recipient.address}`
          : active.recipient.address;

        await ctx.editMessageText(
          "⚡️ PROMPT DELIVERED\n\n" +
            `TO:\n${recipientInfo}\n\n` +
            "• Sent via Coinbase Wallet\n" +
            "• Secure delivery confirmed\n" +
            "• @suite"
        );
        this.activeMessages.delete(ctx.chat.id);
      } catch (error) {
        await ctx.editMessageText(
          `❌ Delivery failed: ${error.message}\n\n` +
            "Please try again or contact @suite for support"
        );
      }
    });

    this.bot.action("edit", async (ctx) => {
      const active = this.activeMessages.get(ctx.chat.id);
      if (!active) return;

      active.step = "composition";
      await ctx.reply(
        "○ EDIT PROMPT\n\n" + "Enter your revised message:",
        Markup.keyboard([["Cancel"]])
          .oneTime()
          .resize()
      );
    });

    this.bot.action("cancel", async (ctx) => {
      this.activeMessages.delete(ctx.chat.id);
      await ctx.editMessageText("Message cancelled");
    });
  }

  /**
   * Send message via XMTP protocol
   * @param {string} recipient - Recipient's Ethereum address
   * @param {string} message - Message content
   * @returns {Promise<Object>} Sent message confirmation
   */
  async sendMessage(recipient, message) {
    try {
      const canMessage = await this.client.canMessage(recipient);
      if (!canMessage) {
        throw new Error(`Recipient cannot receive messages`);
      }

      const conversation = await this.client.conversations.newConversation(
        recipient
      );
      return await conversation.send(message);
    } catch (error) {
      console.error("Message sending failed:", error.message);
      throw error;
    }
  }

  /**
   * Validate Ethereum address format
   * @param {string} address - Address to validate
   * @returns {boolean} Whether address is valid
   */
  isValidEthereumAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
}

/**
 * Initialize and start the messenger
 */
async function main() {
  try {
    await new XMTPMessenger().initialize();
  } catch (error) {
    console.error("Startup failed:", error.message);
  }
}

main();
