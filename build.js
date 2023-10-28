const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer');

const templatesDir = path.join(__dirname, 'templates');
const distDir = path.join(__dirname, 'dist');
const distTemplatesDir = path.join(distDir, 'templates');
const templatesIndexFile = path.join(distDir, 'templates.json');

const appUrl = 'https://web.teamforms.app';

function serveDist() {
    return http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Access-Control-Allow-Headers', 'content-type');

        fs.readFile(distDir + req.url, (err, data) => {
            if (err) {
                res.statusCode = 500;
                res.end(`Error getting the file: ${err}.`);
                return;
            }
            res.end(data);
        })
    }).listen();
}

async function buildTemplates(distServerPort) {
    const files = fs.readdirSync(templatesDir)
        .filter(file => file.endsWith('.json'));

    const browser = await puppeteer.launch({ headless: 'new' });

    const templates = []
    for (const file of files) {
        const filePath = path.join(templatesDir, file);
        const template = require(filePath);

        if (!template.title) throw new Error(`Template ${file} is missing a title`);
        if (typeof template.title !== 'string') throw new Error(`Template ${file} title must be a string`);

        if (template.description && typeof template.description !== 'string') throw new Error(`Template ${file} description must be a string`);
        if (template.icon && typeof template.icon !== 'string') throw new Error(`Template ${file} icon must be a string`);

        if (!Array.isArray(template.tags)) throw new Error(`Template ${file} tags must be an array`);
        if (!template.tags.every(t => typeof t === 'string')) throw new Error(`Template ${file} tags must be an array of strings`);

        fs.copyFileSync(filePath, path.join(distTemplatesDir, file));

        const templateUrl = `http://localhost:${distServerPort}/templates/${file}`;

        const page = await browser.newPage();
        await page.goto(`${appUrl}/templates/${encodeURIComponent(templateUrl)}/preview`);
        await page.waitForSelector('div.formio-form');
        await page.screenshot({ path: path.join(distTemplatesDir, file.replace('.json', '.png')) });
        await page.close();

        templates.push({
            key: file.replace('.json', ''),
            title: template.title,
            description: template.description,
            tags: template.tags,
            image: 'templates/' + file.replace('.json', '.png'),
        });
    }

    await browser.close();
    fs.writeFileSync(templatesIndexFile, JSON.stringify(templates, null, 2));
}

fs.existsSync(distDir) || fs.mkdirSync(distDir);
fs.existsSync(distTemplatesDir) || fs.mkdirSync(distTemplatesDir);

const server = serveDist();
buildTemplates(server.address().port)
    .finally(() => server.close());
