const DRIN_SUPPORT_AVATAR =
    "https://zdinvxowzpkolbfzpcac.supabase.co/storage/v1/object/public/product-images/DeSupport.png";

let drinChatConversationId = null;

let drinChatChannel = null;

let drinTypingChannel = null;

function getSupportStatusText() {
    if (isLiveChatAvailable()) {
        return "🟢 Live chat available";
    }

    return "🔴 Offline now — auto reply active";
}

function refreshChatStatus() {

    const status = document.getElementById("chatSupportStatus");

    if (status) {
        status.textContent = getSupportStatusText();
    }

    updateChatAvailability();
}

function updateChatAvailability() {

    const input = document.getElementById("websiteChatInput");
    const sendBtn = document.getElementById("chatSendButton");

    if (!input || !sendBtn) return;

    if (isLiveChatAvailable()) {

        input.placeholder = "Type your message...";
        sendBtn.disabled = false;
        sendBtn.style.opacity = "1";

    } else {

        input.placeholder = "Leave your concern here. Drin Electronics will reply soon.";
        sendBtn.disabled = false;
        sendBtn.style.opacity = "1";
    }
}

function ensureChatModal() {
    if (document.getElementById("websiteChatModal")) return;

    const modal = document.createElement("div");
    modal.id = "websiteChatModal";
    modal.className = "website-chat-modal";

    modal.innerHTML = `
    <div class="website-chat-box">
      <div class="website-chat-header">
        <img src="${DRIN_SUPPORT_AVATAR}" alt="Drin Support">
        <div>
          <strong>Drin Support Assistant</strong>
         <small id="chatSupportStatus">${getSupportStatusText()}</small>
        </div>
        <button type="button" class="website-chat-close" onclick="closeWebsiteChat()">×</button>
      </div>

      
      <div id="guestNameForm" class="guest-name-form">
  <p>
    Hi 👋 Welcome to Drin Electronics.
    <br>
    Please enter your name to start chatting.
  </p>

  <input
    id="guestNameInput"
    type="text"
    placeholder="Your name"
    autocomplete="name"
  >

  <button
    type="button"
    onclick="startGuestChat()"
  >
    Start Chat
  </button>
</div>

<div id="chatMainUI">
  <div id="websiteChatMessages" class="website-chat-messages"></div>
</div>


      <div id="emojiPanel" style="display:none; position:absolute; bottom:70px; left:10px; background:white; padding:8px; border-radius:10px;">

   
    <span onclick="addEmoji('👍')">👍</span>
    <span onclick="addEmoji('😊')">😊</span>
    <span onclick="addEmoji('😍')">😍</span>
    <span onclick="addEmoji('❤️')">❤️</span>
    <span onclick="addEmoji('🙏')">🙏</span>
    <span onclick="addEmoji('🤝')">🤝</span>
    <span onclick="addEmoji('👏')">👏</span>
    <span onclick="addEmoji('😢')">😢</span>


</div>

     <div id="chatInputRow" class="website-chat-input-row" style="display:none;">

      <input
  type="file"
  id="chatFileInput"
  hidden
  accept="image/*,video/*"
>

  <button type="button" onclick="toggleEmojiPanel()">😊</button>

  <input 
    id="websiteChatInput" 
    type="text" 
    placeholder="Type your message..."
    autocomplete="off"
  >

  <button type="button" onclick="document.getElementById('chatFileInput').click()">📎</button>

  <button id="chatSendButton" type="button" onclick="sendWebsiteChatMessage()">Send</button>

</div>
  `;

    document.body.appendChild(modal);

    document
        .getElementById("websiteChatInput")
        ?.addEventListener("keydown", function (event) {

            if (event.key === "Enter") {
                event.preventDefault();
                sendWebsiteChatMessage();
            }

        });

    document
        .getElementById("chatFileInput")
        ?.addEventListener("change", async function (event) {

            const file = event.target.files?.[0];

            if (!file) return;

            await uploadChatMedia(file);

            event.target.value = "";

        });

}

function showChatAlert(title, message) {
    let modal = document.getElementById("chatAlertModal");

    if (!modal) {
        modal = document.createElement("div");
        modal.id = "chatAlertModal";
        modal.className = "chat-alert-modal";

        modal.innerHTML = `
            <div class="chat-alert-box">
                <div class="chat-alert-icon">!</div>
                <h3 id="chatAlertTitle">Notice</h3>
                <p id="chatAlertMessage">Message here</p>
                <button type="button" onclick="closeChatAlert()">
                    OK
                </button>
            </div>
        `;

        document.body.appendChild(modal);
    }

    document.getElementById("chatAlertTitle").textContent = title;
    document.getElementById("chatAlertMessage").textContent = message;

    modal.classList.add("show");
}

function closeChatAlert() {
    document.getElementById("chatAlertModal")?.classList.remove("show");
}

function isLiveChatAvailable() {
    const now = new Date();
    const hour = now.getHours();

    return hour >= 9 && hour < 21;
}

function getChatWelcomeMessage() {

    if (isLiveChatAvailable()) {
        return `
Hi 👋 Welcome to Drin Electronics.

🟢 Our support team is currently active.

Please send us your concern and allow a few minutes for response.

🛒 You may also browse products and place orders directly on our website anytime.
        `;
    }

    return `
Hi 👋 Welcome to Drin Electronics.

🔴 Our live chat is currently offline.

Please leave your concern here and our team will reply as soon as possible.
`;
}

function renderSystemWelcome() {
    const box = document.getElementById("websiteChatMessages");
    if (!box) return;

    if (box.dataset.welcomeShown === "yes") return;

    box.dataset.welcomeShown = "yes";

    box.innerHTML += `
    <div class="chat-msg system">
   ${getChatWelcomeMessage()}
    </div>
  `;

    box.scrollTop = box.scrollHeight;
}

async function createChatConversationIfNeeded() {

    let guestId = localStorage.getItem("drinGuestId");

    if (!guestId) {
        guestId = "guest_" + Date.now();

        localStorage.setItem(
            "drinGuestId",
            guestId
        );
    }

    const { data: existingConversation } =
        await supabaseClient
            .from("chat_conversations")
            .select("id")
            .eq("guest_id", guestId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

    if (existingConversation?.id) {
        drinChatConversationId = existingConversation.id;
        return drinChatConversationId;
    }

    const { data, error } = await supabaseClient
        .from("chat_conversations")
        .insert({
            guest_id: guestId,
            guest_name: "Guest Customer",
            page_url: window.location.href,
            status: "open",
            updated_at: new Date().toISOString()
        })
        .select("id")
        .single();

    if (error) {
        console.error("Chat conversation error:", error);
        return null;
    }

    drinChatConversationId = data.id;
    return drinChatConversationId;
}

async function loadChatMessages() {
    const box = document.getElementById("websiteChatMessages");
    if (!box || !drinChatConversationId) return;

    const { data, error } = await supabaseClient
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", drinChatConversationId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Load chat messages error:", error);
        return;
    }

    box.innerHTML = "";
    delete box.dataset.welcomeShown;

    renderSystemWelcome();

    if (!data || data.length === 0) return;

    data.forEach((msg) => appendChatMessage(msg, false));

    box.scrollTop = box.scrollHeight;
}

function appendChatMessage(msg, scroll = true) {
    const box = document.getElementById("websiteChatMessages");
    if (!box) return;

    const div = document.createElement("div");

    div.dataset.chatId = msg.id;

    div.className = `chat-msg ${msg.sender_type || "system"}`;

    if (msg.image_url) {

        div.innerHTML = `
      <img
        src="${msg.image_url}"
        class="chat-image">
    `;

    }
    else if (msg.video_url) {

        div.innerHTML = `
      <video
        controls
        class="chat-video">

        <source src="${msg.video_url}">
      </video>
    `;

    }
    else {

        const urlRegex = /(https?:\/\/[^\s]+)/g;

        if (urlRegex.test(msg.message)) {

            const url = msg.message.match(urlRegex)[0];

            const shortUrl = new URL(url).hostname;

            div.innerHTML = `
            <a href="${url}" target="_blank">
                🔗 ${shortUrl}
            </a>
        `;

        } else {

            div.textContent = msg.message;
        }
    }

    box.appendChild(div);

    if (scroll) {
        box.scrollTop = box.scrollHeight;
    }
}

function subscribeChatRealtime() {
    if (!drinChatConversationId || drinChatChannel) return;

    drinChatChannel = supabaseClient
        .channel(`chat-${drinChatConversationId}`)
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "chat_messages",
                filter: `conversation_id=eq.${drinChatConversationId}`
            },

            (payload) => {

                const existing =
                    document.querySelector(
                        `[data-chat-id="${payload.new.id}"]`
                    );

                if (existing) return;

                appendChatMessage(payload.new);

                updateChatUnreadBadge();

            }
        )
        .subscribe();
}

async function openWebsiteChat() {


    ensureChatModal();

    const modal = document.getElementById("websiteChatModal");

    if (modal?.classList.contains("show")) {
        closeWebsiteChat();
        return;
    }

    modal?.classList.add("show");

    const conversationId =
        await createChatConversationIfNeeded();

    const { data: conversation } =
        await supabaseClient
            .from("chat_conversations")
            .select("guest_name")
            .eq("id", conversationId)
            .single();

    if (
        conversation?.guest_name === "Guest Customer"
    ) {
        document.getElementById("guestNameForm").style.display = "block";
        document.getElementById("chatMainUI").classList.remove("active");
        document.getElementById("chatInputRow").style.display = "none";
        return;
    }

    document.getElementById("guestNameForm").style.display = "none";
    document.getElementById("chatMainUI").classList.add("active");
    document.getElementById("chatInputRow").style.display = "flex";

    await loadChatMessages();

    await supabaseClient
        .from("chat_messages")
        .update({ is_read: true })
        .eq("conversation_id", drinChatConversationId)
        .eq("sender_type", "admin");

    await updateChatUnreadBadge();
    subscribeChatRealtime();
    subscribeTypingStatus();

    setTimeout(() => {
        document.getElementById("websiteChatInput")?.focus();
    }, 100);
}

function closeWebsiteChat() {
    document.getElementById("websiteChatModal")?.classList.remove("show");
}

async function startGuestChat() {
    const nameInput =
        document.getElementById("guestNameInput");

    const guestName =
        nameInput?.value.trim();

    if (!guestName) {

        showChatAlert(
            "Name Required",
            "Please enter your name to start chatting."
        );

        return;
    }

    const conversationId =
        await createChatConversationIfNeeded();

    if (!conversationId) return;

    await supabaseClient
        .from("chat_conversations")
        .update({
            guest_name: guestName,
            customer_name: guestName,
            updated_at: new Date().toISOString()
        })
        .eq("id", conversationId);

    await supabaseClient
        .from("chat_typing_status")
        .upsert({
            conversation_id: conversationId,
            sender_type: "customer",
            is_typing: false,
            draft_text: "",
            updated_at: new Date().toISOString()
        });

    document.getElementById("guestNameForm").style.display = "none";
    document.getElementById("chatMainUI").classList.add("active");
    document.getElementById("chatInputRow").style.display = "flex";

    await loadChatMessages();

    document.getElementById("websiteChatInput")?.focus();
}

async function sendOfflineAutoReplyIfNeeded(conversationId) {

    if (isLiveChatAvailable()) return;

    const thirtyMinutesAgo =
        new Date(Date.now() - 30 * 60 * 1000).toISOString();

    // Stop auto reply only if admin manually replied within last 30 minutes
    const { data: recentAdminReply } = await supabaseClient
        .from("chat_messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("sender_type", "admin")
        .gte("created_at", thirtyMinutesAgo)
        .limit(1)
        .maybeSingle();

    if (recentAdminReply) return;

    // Prevent repeated offline auto reply within 30 minutes
    const { data: existingOfflineReply } = await supabaseClient
        .from("chat_messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("sender_type", "system")
        .ilike("message", "%support team is currently offline%")
        .gte("created_at", thirtyMinutesAgo)
        .limit(1)
        .maybeSingle();

    if (existingOfflineReply) return;

    const offlineReply = `
Hi! Thank you for messaging Drin Electronics.

We have received your message and our support team is currently offline.

🛒 Looking for products?

You can order directly on our website:

• Browse products on Home Page
• Add items to Cart
• Proceed to Checkout
• Place your Order instantly

We will reply here as soon as possible.

Thank you for choosing Drin Electronics.
`;

    await supabaseClient
        .from("chat_messages")
        .insert({
            conversation_id: conversationId,
            sender_type: "system",
            message: offlineReply,
            is_read: false
        });
}

async function sendWebsiteChatMessage() {
    const input = document.getElementById("websiteChatInput");
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    const conversationId = await createChatConversationIfNeeded();

    const { data: conversation } =
        await supabaseClient
            .from("chat_conversations")
            .select("guest_name")
            .eq("id", conversationId)
            .single();

    if (conversation?.guest_name === "Guest Customer") {

        await supabaseClient
            .from("chat_conversations")
            .update({
                guest_name: message,
                customer_name: message
            })
            .eq("id", conversationId);

        appendChatMessage({
            sender_type: "system",
            message: "Thank you. You may now continue your inquiry 😊"
        });

        input.value = "";

        return;
    }

    input.value = "";

    const { data, error } = await supabaseClient
        .from("chat_messages")
        .insert({
            conversation_id: conversationId,
            sender_type: "customer",
            message,
            is_read: false
        })
        .select()
        .single();

    if (error) {
        console.error("Send message error:", error);
        return;
    }

    appendChatMessage(data);
    await sendOfflineAutoReplyIfNeeded(conversationId);

    await supabaseClient
        .from("chat_conversations")
        .update({
            updated_at: new Date().toISOString(),
            last_message: message
        })
        .eq("id", conversationId);
}

document.addEventListener("DOMContentLoaded", async () => {

    ensureChatModal();

    updateChatUnreadBadge();

    refreshChatStatus();

    setInterval(() => {
        refreshChatStatus();
    }, 60000);
});

let chatTypingTimer = null;

async function setWebsiteTypingStatus(isTyping) {
    if (!drinChatConversationId) return;

    const input =
        document.getElementById("websiteChatInput");

    await supabaseClient
        .from("chat_typing_status")
        .upsert({
            conversation_id: drinChatConversationId,
            sender_type: "customer",
            is_typing: isTyping,
            draft_text: isTyping ? input?.value || "" : "",
            updated_at: new Date().toISOString()
        });
}

function showAdminTypingIndicator(show) {
    const box = document.getElementById("websiteChatMessages");
    if (!box) return;

    let indicator = document.getElementById("adminTypingIndicator");

    if (!show) {
        indicator?.remove();
        return;
    }

    if (indicator) return;

    indicator = document.createElement("div");
    indicator.id = "adminTypingIndicator";
    indicator.className = "typing-indicator";
    indicator.innerHTML = `
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
  `;

    box.appendChild(indicator);
    box.scrollTop = box.scrollHeight;
}

function subscribeTypingStatus() {
    if (!drinChatConversationId || drinTypingChannel) return;

    drinTypingChannel = supabaseClient
        .channel(`typing-${drinChatConversationId}`)
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "chat_typing_status",
                filter: `conversation_id=eq.${drinChatConversationId}`
            },
            (payload) => {

                const row = payload.new;

                if (row.sender_type === "admin") {
                    showAdminTypingIndicator(row.is_typing);
                }

            }
        )
        .subscribe();
}

document.addEventListener("input", (event) => {
    if (event.target?.id !== "websiteChatInput") return;

    setWebsiteTypingStatus(true);

    clearTimeout(chatTypingTimer);

    chatTypingTimer = setTimeout(() => {
        setWebsiteTypingStatus(false);
    }, 1200);
});

window.addEventListener("blur", () => {
    setWebsiteTypingStatus(false);
});

document.addEventListener("visibilitychange", () => {

    if (document.hidden) {
        setWebsiteTypingStatus(false);
    }

});

async function uploadChatMedia(file) {

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
        alert("Image or video only.");
        return;
    }

    const folder = isImage ? "images" : "videos";
    const fileName = `${Date.now()}-${file.name}`;
    const path = `${folder}/${fileName}`;

    const { error: uploadError } = await supabaseClient
        .storage
        .from("chat-media")
        .upload(path, file);

    if (uploadError) {
        console.error("Upload error:", uploadError);
        alert("Upload failed.");
        return;
    }

    const { data: publicData } = supabaseClient
        .storage
        .from("chat-media")
        .getPublicUrl(path);

    const url = publicData.publicUrl;

    const conversationId = await createChatConversationIfNeeded();

    if (!conversationId) return;

    const { data, error } = await supabaseClient
        .from("chat_messages")
        .insert({
            conversation_id: conversationId,
            sender_type: "customer",
            message: isImage ? "📷 Image" : "🎥 Video",
            image_url: isImage ? url : null,
            video_url: isVideo ? url : null,
            is_read: false
        })
        .select()
        .single();

    if (error) {
        console.error("Media message insert error:", error);
        alert("Media send failed.");
        return;
    }

    appendChatMessage(data);

    await sendOfflineAutoReplyIfNeeded(conversationId);

    await supabaseClient
        .from("chat_conversations")
        .update({
            updated_at: new Date().toISOString(),
            last_message: isImage ? "📷 Image" : "🎥 Video"
        })
        .eq("id", conversationId);
}

function toggleEmojiPanel() {
    const panel = document.getElementById("emojiPanel");
    if (!panel) return;

    panel.style.display =
        panel.style.display === "block" ? "none" : "block";
}

function addEmoji(emoji) {

    const input =
        document.getElementById("websiteChatInput");

    if (!input) return;

    input.value += emoji;

    const panel =
        document.getElementById("emojiPanel");

    if (panel) {
        panel.style.display = "none";
    }

    input.focus();
}

async function updateChatUnreadBadge() {

    if (!drinChatConversationId) return;

    const { data } = await supabaseClient
        .from("chat_messages")
        .select("id")
        .eq("conversation_id", drinChatConversationId)
        .eq("sender_type", "admin")
        .eq("is_read", false);

    const count = data?.length || 0;

    const badges = document.querySelectorAll(
        "#chatUnreadBadge, #mobileChatUnreadBadge"
    );

    badges.forEach((badge) => {

        badge.textContent = count;

        badge.style.display =
            count > 0 ? "flex" : "none";

    });

}

function forceRemoveChatProductPreview() {
    document.getElementById("chatProductPreview")?.remove();
}

setInterval(forceRemoveChatProductPreview, 300);

document.addEventListener("input", async (event) => {
    if (event.target?.id !== "guestNameInput") return;

    if (!drinChatConversationId) {
        await createChatConversationIfNeeded();
    }

    const { error } = await supabaseClient
        .from("chat_typing_status")
        .upsert({
            conversation_id: drinChatConversationId,
            sender_type: "customer",
            is_typing: true,
            draft_text: event.target.value,
            updated_at: new Date().toISOString()
        });

    if (error) {
        console.error("SUPABASE TYPING ERROR:", error);
    }
});

window.openWebsiteChat = openWebsiteChat;
window.closeWebsiteChat = closeWebsiteChat;
window.startGuestChat = startGuestChat;
window.sendWebsiteChatMessage = sendWebsiteChatMessage;
window.toggleEmojiPanel = toggleEmojiPanel;
window.addEmoji = addEmoji;
window.closeChatAlert = closeChatAlert;