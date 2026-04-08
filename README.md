# Elite Tournament Club (Node.js puro, sem npm)

Aplicativo full-stack para gestão de torneios/eventos com área do jogador, área administrativa, inscrição, fila de espera, check-in e PWA — **sem bibliotecas externas**, sem CDN e sem build tools.

## Requisitos
- Node.js 18+ (recomendado)
- Navegador moderno (Chrome/Edge para BarcodeDetector)

## Como rodar
```bash
node server.js
```
Abra:
- Jogador: http://localhost:3000/
- Admin: http://localhost:3000/admin

## Credenciais demo
- **Admin**: `admin@eliteclub.local` / `admin123`
- **Jogador**: `lucas@eliteclub.local` / `player123`

## Funcionalidades implementadas
- Autenticação: login, cadastro, logout e recuperação local de senha.
- Perfis admin/jogador e proteção básica de rotas no backend.
- Gestão de torneios/eventos (CRUD essencial para admin).
- Inscrições com atualização de vagas.
- Lista de espera com promoção automática quando surge vaga.
- Notificações internas.
- Check-in com validação de token assinado e confirmação anti-duplicidade.
- Tela admin com scanner via `BarcodeDetector` + fallback manual por token.
- Histórico de check-ins para jogador e admin.
- PWA com `manifest.json` e `service-worker.js`.

## Estrutura
```
/
  server.js
  README.md
  /data
    users.json
    tournaments.json
    events.json
    registrations.json
    waitlist.json
    checkins.json
    notifications.json
    sessions.json
  /public
    index.html
    app.js
    styles.css
    manifest.json
    service-worker.js
    /lib
      qr.js
    /assets
      icon-192.svg
      icon-512.svg
  /admin
    admin.html
    admin.js
    admin.css
```

## Observações importantes
- Não existe `npm install` neste projeto.
- Persistência em JSON local; se os arquivos estiverem vazios, o backend cria dados demo automaticamente ao subir.
- Scanner nativo depende do navegador/dispositivo/câmera e contexto seguro. Quando indisponível, use fallback manual no painel admin.
- O token de check-in contém payload assinado no backend para reduzir fraude trivial em ambiente local/demo.

- Ícones foram fornecidos em SVG local para manter compatibilidade com ambientes sem suporte a binários no versionamento.
