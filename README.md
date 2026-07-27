# Meu Consumo

Aplicativo responsivo para registrar bebidas e calcular uma estimativa de álcool puro consumido.

## Como executar

1. Abra a pasta no Visual Studio Code.
2. Instale a extensão **Live Server**.
3. Clique com o botão direito no arquivo `index.html`.
4. Clique em **Open with Live Server**.

## Arquivos

- `index.html`: estrutura da aplicação.
- `styles.css`: identidade visual vermelha e responsividade.
- `app.js`: cálculos, histórico, gráficos e LocalStorage.
- `manifest.json`: configuração PWA.
- `service-worker.js`: cache básico para funcionamento offline.

## Fórmulas

- Álcool puro em ml = volume × quantidade × percentual alcoólico ÷ 100
- Álcool em gramas = álcool puro em ml × 0,789
- Doses padrão = álcool em gramas ÷ valor configurado
- Calorias aproximadas = álcool em gramas × 7

A estimativa de calorias considera somente o álcool e não inclui açúcares ou outros ingredientes.

## Observação

O aplicativo não calcula com precisão o nível de embriaguez e nunca deve ser usado para decidir se alguém pode dirigir, trabalhar ou operar máquinas.
