const DRIN_SUPPORT_AVATAR =
    "https://zdinvxowzpkolbfzpcac.supabase.co/storage/v1/object/public/product-images/DeSupport.png";

let drinChatConversationId =
    localStorage.getItem("drinChatConversationId") || null;

let drinChatChannel = null;

let drinTypingChannel = null;

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
          <small>🟢 Online support</small>
        </div>
        <button type="button" class="website-chat-close" onclick="closeWebsiteChat()">×</button>
      </div>

      <div id="websiteChatMessages" class="website-chat-messages"></div>

      <div id="emojiPanel" style="display:none; position:absolute; bottom:70px; left:10px; background:white; padding:8px; border-radius:10px;">

   <span onclick="addEmoji('😢')">😢</span>
   <span onclick="addEmoji('😊')">😊</span>
  <span onclick="addEmoji('😍')">😍</span>
  <span onclick="addEmoji('❤️')">❤️</span>
  <span onclick="addEmoji('👍')">👍</span>


</div>

      <div class="website-chat-input-row">

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

  <button type="button" onclick="sendWebsiteChatMessage()">Send</button>

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



function renderSystemWelcome() {
    const box = document.getElementById("websiteChatMessages");
    if (!box) return;

    if (box.dataset.welcomeShown === "yes") return;

    box.dataset.welcomeShown = "yes";

    box.innerHTML += `
    <div class="chat-msg system">
      Hi 👋 Welcome to Drin Electronics Support. How can we help you today?
    </div>
  `;

    box.scrollTop = box.scrollHeight;
}

async function createChatConversationIfNeeded() {
    if (drinChatConversationId) return drinChatConversationId;

    const guestId =
        localStorage.getItem("drinGuestId") ||
        crypto.randomUUID();

    localStorage.setItem("drinGuestId", guestId);

    const { data, error } = await supabaseClient
        .from("chat_conversations")
        .insert({
            guest_id: guestId,
            page_url: window.location.href,
            status: "open"
        })
        .select("id")
        .single();

    if (error) {
        console.error("Chat conversation error:", error);
        return null;
    }

    drinChatConversationId = data.id;
    localStorage.setItem("drinChatConversationId", drinChatConversationId);

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

    if (!data || data.length === 0) {
        renderSystemWelcome();
        return;
    }

    data.forEach((msg) => appendChatMessage(msg, false));
    box.scrollTop = box.scrollHeight;
}

function appendChatMessage(msg, scroll = true) {
    const box = document.getElementById("websiteChatMessages");
    if (!box) return;

    const div = document.createElement("div");
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

        div.textContent = msg.message;

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

                if (payload.new.sender_type === "customer") {
                    return;
                }

                appendChatMessage(payload.new);

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

    await createChatConversationIfNeeded();
    await loadChatMessages();

    subscribeChatRealtime();
    subscribeTypingStatus();

    setTimeout(() => {
        document.getElementById("websiteChatInput")?.focus();
    }, 100);
}

function closeWebsiteChat() {
    document.getElementById("websiteChatModal")?.classList.remove("show");
}

async function sendWebsiteChatMessage() {
    const input = document.getElementById("websiteChatInput");
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    input.value = "";

    appendChatMessage({
        sender_type: "customer",
        message
    });

    const conversationId = await createChatConversationIfNeeded();

    if (!conversationId) return;

    const { error } = await supabaseClient
        .from("chat_messages")
        .insert({
            conversation_id: conversationId,
            sender_type: "customer",
            message
        });

    if (error) {
        console.error("Send message error:", error);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    ensureChatModal();

    await createChatConversationIfNeeded();

    subscribeChatRealtime();
    subscribeTypingStatus();
});

let chatTypingTimer = null;

async function setWebsiteTypingStatus(isTyping) {
    if (!drinChatConversationId) return;

    await supabaseClient
        .from("chat_typing_status")
        .upsert({
            conversation_id: drinChatConversationId,
            sender_type: "customer",
            is_typing: isTyping,
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
    const folder = isImage ? "images" : "videos";

    const fileName = `${Date.now()}-${file.name}`;
    const path = `${folder}/${fileName}`;

    const { error } = await supabaseClient
        .storage
        .from("chat-media")
        .upload(path, file);

    if (error) {
        console.error("Upload error:", error);
        return;
    }

    const { data } = supabaseClient
        .storage
        .from("chat-media")
        .getPublicUrl(path);

    const url = data.publicUrl;

    const conversationId = await createChatConversationIfNeeded();

    await supabaseClient.from("chat_messages").insert({
        conversation_id: conversationId,
        sender_type: "customer",
        message: null,
        image_url: isImage ? url : null,
        video_url: !isImage ? url : null
    });

}

function toggleEmojiPanel() {
    const panel = document.getElementById("emojiPanel");
    if (!panel) return;

    panel.style.display =
        panel.style.display === "block" ? "none" : "block";
}

function addEmoji(emoji) {
    const input = document.getElementById("websiteChatInput");
    if (!input) return;

    input.value += emoji;
}

function initGlobalChat() {
    ensureChatModal();
}

document.addEventListener("DOMContentLoaded", initGlobalChat);

