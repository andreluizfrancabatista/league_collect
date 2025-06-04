const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

// Função para adicionar delay entre requisições
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class FBRefScraper {
    constructor() {
        this.baseUrl = 'https://fbref.com/en/comps/';
        this.targetTableIds = [
            'comps_club',
            'comps_1_fa_club_league_senior',
            'comps_2_fa_club_league_senior',
            'comps_3_fa_club_league_senior'
        ];
        this.dataset = {};
    }

    async fetchPage() {
        try {
            console.log('Buscando dados da página...');
            
            // Adicionar delay inicial respeitando rate limiting
            await delay(2000);
            
            const response = await axios.get(this.baseUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                timeout: 15000
            });
            
            if (response.status !== 200) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }
            
            console.log('Página carregada com sucesso!');
            return response.data;
        } catch (error) {
            console.error('Erro ao buscar a página:', error.message);
            throw error;
        }
    }

    extractLeagueData($, tableId) {
        console.log(`Procurando tabela: ${tableId}`);
        
        // Primeiro tentar encontrar a tabela diretamente
        let table = $(`#${tableId}`);
        
        // Se não encontrar, procurar nos comentários HTML
        if (table.length === 0) {
            console.log(`Tabela ${tableId} não encontrada diretamente, procurando nos comentários...`);
            
            // Procurar div que contém a tabela comentada
            const containerDiv = $(`#all_${tableId}`);
            if (containerDiv.length > 0) {
                // Buscar comentários dentro do container
                const comments = containerDiv.contents().filter(function() {
                    return this.type === 'comment';
                });
                
                if (comments.length > 0) {
                    // Processar o maior comentário (mais provável de conter a tabela)
                    let largestComment = '';
                    comments.each(function() {
                        if (this.data && this.data.length > largestComment.length) {
                            largestComment = this.data;
                        }
                    });
                    
                    if (largestComment) {
                        const commentSoup = cheerio.load(largestComment);
                        table = commentSoup(`#${tableId}`);
                        console.log(`Tabela encontrada nos comentários: ${tableId}`);
                        $ = commentSoup; // Atualizar o contexto do cheerio
                    }
                }
            }
        }
        
        if (table.length === 0) {
            console.log(`Tabela com ID ${tableId} não encontrada nem nos comentários`);
            return;
        }

        console.log(`Processando tabela: ${tableId} (${table.find('tbody tr').length} linhas)`);
        
        let processedRows = 0;
        
        table.find('tbody tr').each((index, row) => {
            const $row = $(row);
            
            // Extrair país
            const countryTd = $row.find('td[data-stat="country"]');
            if (countryTd.length === 0) return;
            
            // Buscar o segundo link que contém apenas o código do país
            const countryLinks = countryTd.find('a');
            if (countryLinks.length === 0) {
                // console.log('Linha ignorada: sem link do país');
                return; // Ignorar se não houver link do país
            }
            
            let country = '';
            // Se há múltiplos links, o código do país geralmente está no segundo
            if (countryLinks.length >= 2) {
                country = countryLinks.eq(1).text().trim();
            } else {
                // Se há apenas um link, tentar extrair apenas o texto que não está no span
                const linkText = countryLinks.eq(0).text().trim();
                // Remover caracteres especiais e pegar apenas letras maiúsculas
                const matches = linkText.match(/[A-Z]{3}/);
                country = matches ? matches[0] : '';
            }
            
            if (!country || country.length !== 3) {
                console.log(`País inválido encontrado: "${country}" (texto original: "${countryTd.text().trim()}")`);
                return; // Validar se é uma sigla de 3 letras
            }

            // Extrair nome da liga
            const leagueNameTh = $row.find('th[data-stat="league_name"]');
            if (leagueNameTh.length === 0) {
                console.log('Linha ignorada: sem nome da liga');
                return;
            }
            
            const leagueNameLink = leagueNameTh.find('a');
            if (leagueNameLink.length === 0) {
                console.log('Linha ignorada: sem link da liga');
                return;
            }
            
            const leagueName = leagueNameLink.text().trim();
            if (!leagueName) {
                console.log('Linha ignorada: nome da liga vazio');
                return;
            }

            // Extrair URL da liga
            const maxSeasonTd = $row.find('td[data-stat="maxseason"]');
            if (maxSeasonTd.length === 0) {
                console.log('Linha ignorada: sem maxseason');
                return;
            }
            
            const maxSeasonLink = maxSeasonTd.find('a');
            if (maxSeasonLink.length === 0) {
                console.log('Linha ignorada: sem link maxseason');
                return;
            }
            
            const originalUrl = maxSeasonLink.attr('href');
            if (!originalUrl) {
                console.log('Linha ignorada: URL vazia');
                return;
            }

            // Converter URL para o formato de fixtures
            const convertedUrl = this.convertToFixturesUrl(originalUrl);
            if (!convertedUrl) {
                console.log(`URL não pôde ser convertida: ${originalUrl}`);
                return;
            }

            // Adicionar ao dataset
            if (!this.dataset[country]) {
                this.dataset[country] = {};
            }
            
            this.dataset[country][leagueName] = convertedUrl;
            processedRows++;
            
            console.log(`✓ Adicionado: ${country} - ${leagueName}`);
        });
        
        console.log(`Tabela ${tableId}: ${processedRows} registros processados`);
    }

    convertToFixturesUrl(originalUrl) {
        try {
            // Formato esperado: /en/comps/{id}/{nome-fantasia}-Stats
            // Converter para: https://fbref.com/en/comps/{id}/schedule/{nome-fantasia}-Scores-and-Fixtures
            
            const urlPattern = /\/en\/comps\/(\d+)\/([^\/]+)-Stats/;
            const match = originalUrl.match(urlPattern);
            
            if (!match) {
                console.warn(`URL não corresponde ao padrão esperado: ${originalUrl}`);
                return null;
            }
            
            const [, leagueId, fantasyName] = match;
            return `https://fbref.com/en/comps/${leagueId}/schedule/${fantasyName}-Scores-and-Fixtures`;
        } catch (error) {
            console.error(`Erro ao converter URL: ${originalUrl}`, error);
            return null;
        }
    }

    async scrapeData() {
        try {
            const html = await this.fetchPage();
            const $ = cheerio.load(html);
            
            console.log('HTML carregado, iniciando extração...');
            console.log(`Tamanho do HTML: ${html.length} caracteres`);
            
            // Verificar se há tabelas na página
            const allTables = $('table').length;
            console.log(`Total de tabelas encontradas: ${allTables}`);
            
            // Verificar se há divs com IDs relacionados
            for (const tableId of this.targetTableIds) {
                const directTable = $(`#${tableId}`);
                const containerDiv = $(`#all_${tableId}`);
                console.log(`Tabela ${tableId}: direta=${directTable.length}, container=${containerDiv.length}`);
            }
            
            console.log('Extraindo dados das tabelas...');
            
            // Processar cada tabela de interesse
            for (const tableId of this.targetTableIds) {
                await delay(1000); // Delay entre processamento de tabelas
                this.extractLeagueData($, tableId);
            }
            
            console.log(`\nResumo da coleta:`);
            console.log(`Total de países: ${Object.keys(this.dataset).length}`);
            
            return this.dataset;
        } catch (error) {
            console.error('Erro durante o scraping:', error);
            throw error;
        }
    }

    async saveToFile(filename = 'fbref-dataset.js') {
        try {
            const content = `const dataset = ${JSON.stringify(this.dataset, null, 4)};

module.exports = dataset;
`;
            
            await fs.writeFile(filename, content, 'utf8');
            console.log(`Dados salvos em: ${filename}`);
            console.log(`Total de países: ${Object.keys(this.dataset).length}`);
            
            // Mostrar resumo
            for (const [country, leagues] of Object.entries(this.dataset)) {
                console.log(`${country}: ${Object.keys(leagues).length} liga(s)`);
            }
        } catch (error) {
            console.error('Erro ao salvar arquivo:', error);
            throw error;
        }
    }
}

async function main() {
    const scraper = new FBRefScraper();
    
    try {
        console.log('Iniciando coleta de dados do FBRef...');
        await scraper.scrapeData();
        await scraper.saveToFile();
        console.log('Processo concluído com sucesso!');
    } catch (error) {
        console.error('Falha na execução:', error.message);
        process.exit(1);
    }
}

// Executar apenas se este arquivo for chamado diretamente
if (require.main === module) {
    main();
}

module.exports = FBRefScraper;