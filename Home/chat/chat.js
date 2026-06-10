const DRIN_SUPPORT_AVATAR =
    "https://zdinvxowzpkolbfzpcac.supabase.co/storage/v1/object/public/product-images/DeSupport.png";

let drinChatConversationId = null;

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

   
    <span onclick="addEmoji('👍')">👍</span>
    <span onclick="addEmoji('😊')">😊</span>
    <span onclick="addEmoji('😍')">😍</span>
    <span onclick="addEmoji('❤️')">❤️</span>
    <span onclick="addEmoji('🙏')">🙏</span>
    <span onclick="addEmoji('🤝')">🤝</span>
    <span onclick="addEmoji('👏')">👏</span>
    <span onclick="addEmoji('😢')">😢</span>


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

    const {
        data: { user }
    } = await supabaseClient.auth.getUser();

    localStorage.removeItem("drinGuestId");

    const { data: existingConversation } =
        await supabaseClient
            .from("chat_conversations")
            .select("id")
            .eq("customer_id", user.id)
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
            customer_id: user.id,
            customer_name:
                user.user_metadata?.full_name ||
                user.email ||
                "Customer",

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

    const {
        data: { user }
    } = await supabaseClient.auth.getUser();

    if (!user) {

        window.location.href =
            "https://drinelectronicsph.com/login/index.html";

        return;
    }

    ensureChatModal();

    const modal = document.getElementById("websiteChatModal");

    if (modal?.classList.contains("show")) {
        closeWebsiteChat();
        return;
    }

    modal?.classList.add("show");

    await createChatConversationIfNeeded();
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

async function sendWebsiteChatMessage() {
    const input = document.getElementById("websiteChatInput");
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    input.value = "";

    const conversationId = await createChatConversationIfNeeded();

    if (!conversationId) return;

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

    const {
        data: { user }
    } = await supabaseClient.auth.getUser();

    if (!user) return;

    await createChatConversationIfNeeded();

    subscribeChatRealtime();
    subscribeTypingStatus();

    updateChatUnreadBadge();
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

function initGlobalChat() {

    ensureChatModal();

}

document.addEventListener(
    "DOMContentLoaded",
    initGlobalChat
);