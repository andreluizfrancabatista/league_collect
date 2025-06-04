# FBRef Data Scraper

Uma aplicação Node.js para coletar dados de ligas de futebol da página [FBRef](https://fbref.com/en/comps/).

## 📋 Descrição

Esta aplicação extrai informações sobre ligas de futebol de diferentes países, organizando os dados por país e gerando URLs para as páginas de fixtures de cada liga.

### Dados Coletados

- **País**: Sigla de 3 letras (ex: BRA, ENG, ESP)
- **Nome da Liga**: Nome completo da liga
- **URL da Liga**: Link para a página de fixtures da liga

### Tabelas Processadas

A aplicação processa apenas as seguintes tabelas da página FBRef:
- `comps_club`
- `comps_1_fa_club_league_senior`
- `comps_2_fa_club_league_senior`
- `comps_3_fa_club_league_senior`

## 🚀 Instalação

1. Clone o repositório:
```bash
git clone <url-do-repositorio>
cd fbref-scraper
```

2. Instale as dependências:
```bash
npm install
```

## 📦 Dependências

- **axios**: Para fazer requisições HTTP
- **cheerio**: Para parsing e manipulação do HTML

## 💻 Uso

Execute a aplicação via linha de comando:

```bash
node index.js
```

### Script de Debug

Se a aplicação não estiver coletando dados, execute o script de debug para analisar a estrutura da página:

```bash
node debug.js
```

Este script irá:
- Salvar o HTML da página em `debug-page.html`
- Analisar a estrutura das tabelas
- Procurar por comentários HTML que contenham as tabelas
- Mostrar informações detalhadas sobre os elementos encontrados

### Resultado

A aplicação gera um arquivo `fbref-dataset.js` com o seguinte formato:

```javascript
const dataset = {
    "BRA": {
        "Série A": "https://fbref.com/en/comps/24/schedule/Serie-A-Scores-and-Fixtures",
        "Série B": "https://fbref.com/en/comps/38/schedule/Serie-B-Scores-and-Fixtures"
    },
    "ENG": {
        "Premier League": "https://fbref.com/en/comps/9/schedule/Premier-League-Scores-and-Fixtures",
        "EFL Championship": "https://fbref.com/en/comps/10/schedule/Championship-Scores-and-Fixtures"
    },
    // ... mais países e ligas
};
```

## 🔧 Funcionamento

1. **Busca da Página**: Faz uma requisição HTTP para obter o HTML da página FBRef
2. **Parsing**: Utiliza Cheerio para analisar o HTML e extrair dados das tabelas específicas
3. **Extração**: Para cada linha das tabelas:
   - Extrai o código do país (3 letras)
   - Extrai o nome da liga
   - Extrai e converte a URL para o formato de fixtures
4. **Organização**: Agrupa as ligas por país
5. **Salvamento**: Gera o arquivo JavaScript com os dados organizados

## 🛠️ Estrutura do Código

### Arquivos Principais

- `index.js`: Aplicação principal com a classe FBRefScraper
- `debug.js`: Script de debug para analisar a estrutura da página
- `package.json`: Configuração do projeto e dependências

### Classe FBRefScraper

- `fetchPage()`: Busca o HTML da página com headers apropriados e rate limiting
- `extractLeagueData()`: Extrai dados de uma tabela específica (incluindo busca em comentários HTML)
- `convertToFixturesUrl()`: Converte URLs para o formato de fixtures
- `scrapeData()`: Coordena todo o processo de extração
- `saveToFile()`: Salva os dados em arquivo

### Tratamento Especial

- **Comentários HTML**: As tabelas do FBRef estão frequentemente dentro de comentários HTML `<!-- ... -->`
- **Rate Limiting**: Inclui delays entre requisições para respeitar as limitações do servidor
- **Headers Robustos**: Utiliza headers de navegador realistas para evitar bloqueios

## 🚨 Solução de Problemas

### Dataset Vazio

Se o arquivo `fbref-dataset.js` estiver vazio:

1. **Execute o debug primeiro**:
   ```bash
   node debug.js
   ```

2. **Verifique os logs**: O script mostra detalhes sobre:
   - Tabelas encontradas diretamente
   - Tabelas dentro de comentários HTML
   - Estrutura geral da página

3. **Analise o HTML**: O debug salva `debug-page.html` para inspeção manual

4. **Problemas comuns**:
   - **Rate limiting**: O site pode estar bloqueando requisições muito rápidas
   - **Estrutura mudou**: Os IDs das tabelas podem ter sido alterados
   - **JavaScript necessário**: Algumas tabelas podem carregar via JavaScript

### Outras Soluções

- Verifique sua conexão com a internet
- Tente executar em horários diferentes (menor tráfego)
- Considere usar um proxy se houver bloqueios geográficos

## 📊 Exemplo de Saída

```
Iniciando coleta de dados do FBRef...
Buscando dados da página...
Extraindo dados das tabelas...
Processando tabela: comps_club
Adicionado: ENG - Premier League
Adicionado: ESP - La Liga
Processando tabela: comps_1_fa_club_league_senior
Adicionado: BRA - Série A
Dados salvos em: fbref-dataset.js
Total de países: 6
ENG: 2 liga(s)
ESP: 2 liga(s)
BRA: 2 liga(s)
Processo concluído com sucesso!
```

## 🚨 Considerações

- A aplicação respeita a estrutura atual da página FBRef
- Inclui headers de User-Agent para evitar bloqueios
- Possui timeout configurado para requisições
- Filtra apenas países com siglas de 3 letras
- Ignora linhas sem dados válidos

## 📄 Licença

Este projeto é de uso educacional e deve respeitar os termos de uso do site FBRef.