(function() {
    // 1. Injection du style CSS pour le look "Robin & fils"
    const style = document.createElement('style');
    style.innerHTML = `
        #my-custom-chat-trigger { position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px; background: #D32F2F; border-radius: 50%; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 30px; z-index: 999999; }
        #my-custom-chat-box { position: fixed; bottom: 90px; right: 20px; width: 350px; height: 500px; background: white; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.2); display: none; flex-direction: column; overflow: hidden; font-family: Arial, sans-serif; z-index: 999999; }
        #my-custom-chat-header { background: #D32F2F; color: white; padding: 15px; font-weight: bold; font-size: 16px; }
        #my-custom-chat-header sub { display: block; font-size: 11px; opacity: 0.9; margin-top: 4px; }
        #my-custom-chat-messages { flex: 1; padding: 15px; overflow-y: auto; background: #f7f7f7; display: flex; flex-direction: column; gap: 10px; }
        .chat-msg { padding: 8px 12px; border-radius: 15px; max-width: 80%; font-size: 14px; }
        .chat-msg.user { background: #D32F2F; color: white; align-self: flex-end; }
        .chat-msg.bot { background: #e0e0e0; color: black; align-self: flex-start; }
        #my-custom-chat-input-area { display: flex; border-top: 1px solid #eee; padding: 10px; background: white; }
        #my-custom-chat-input { flex: 1; border: 1px solid #ddd; padding: 8px; border-radius: 20px; outline: none; }
        #my-custom-chat-send { background: #D32F2F; color: white; border: none; padding: 8px 15px; margin-left: 5px; border-radius: 20px; cursor: pointer; }
    `;
    document.head.appendChild(style);

    // 2. Injection du HTML de la bulle et de la fenêtre
    const chatContainer = document.createElement('div');
    chatContainer.innerHTML = `
        <div id="my-custom-chat-trigger">💬</div>
        <div id="my-custom-chat-box">
            <div id="my-custom-chat-header">
                Robin & fils Support Agent
                <sub>Notre agent IA est là pour répondre à vos questions !</sub>
            </div>
            <div id="my-custom-chat-messages">
                <div class="chat-msg bot">Bonjour ! Comment puis-je vous aider aujourd'hui ?</div>
            </div>
            <div id="my-custom-chat-input-area">
                <input type="text" id="my-custom-chat-input" placeholder="Écrivez votre message...">
                <button id="my-custom-chat-send">▶</button>
            </div>
        </div>
    `;
    document.body.appendChild(chatContainer);

    // 3. Logique d'ouverture / fermeture et d'envoi
    const trigger = document.getElementById('my-custom-chat-trigger');
    const chatBox = document.getElementById('my-custom-chat-box');
    const input = document.getElementById('my-custom-chat-input');
    const sendBtn = document.getElementById('my-custom-chat-send');
    const messagesContainer = document.getElementById('my-custom-chat-messages');

    trigger.addEventListener('click', () => {
        chatBox.style.display = chatBox.style.display === 'flex' ? 'none' : 'flex';
    });

    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        // Afficher le message utilisateur
        appendMessage(text, 'user');
        input.value = '';

        // Envoyer la requête vers TON serveur backend
        try {
            const response = await fetch('https://v3clix-shop.com/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });
            const data = await response.json();
            appendMessage(data.reply, 'bot');
        } catch (error) {
            appendMessage("Désolé, une erreur est survenue.", 'bot');
        }
    }

    function appendMessage(text, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('chat-msg', sender);
        msgDiv.innerText = text;
        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
})();