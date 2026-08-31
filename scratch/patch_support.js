const fs = require('fs');

const path = 'src/templates/pages/support.html';
const replacement = `      <!-- Вкладка: Поддержка (Клиентский чат) -->
      <!-- ================================================================
           ВКЛАДКА НИЖНЕЙ НАВИГАЦИИ: поддержка и FAQ.
           ================================================================ -->
      <section id="tab-support" class="tab-content support-chat-wrapper">
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; height: 100%; padding: 0 20px;">
          <div style="background: rgba(184, 255, 0, 0.05); border: 1px solid rgba(184, 255, 0, 0.1); border-radius: 20px; padding: 40px 20px; max-width: 400px; width: 100%;">
            <div style="font-size: 48px; margin-bottom: 20px; filter: drop-shadow(0 0 10px rgba(184, 255, 0, 0.5));">🛠️</div>
            <h2 style="color: var(--text-primary); font-size: 20px; margin-bottom: 12px; font-weight: 700;">Чат поддержки в разработке</h2>
            <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.5; margin-bottom: 24px;">Прямой чат в приложении появится в следующем обновлении. Пока вы можете написать администратору напрямую в Telegram.</p>
            <a href="https://t.me/ghostlink112_bot" target="_blank" rel="noopener" class="btn-primary" style="display: inline-flex; align-items: center; justify-content: center; text-decoration: none; padding: 14px 24px; border-radius: 12px; font-weight: 600;">
              💬 Написать в Telegram
            </a>
          </div>
        </div>
      </section>`;

fs.writeFileSync(path, replacement);
console.log("Patched support");
