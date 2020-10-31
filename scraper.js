const puppeteer = require('puppeteer');
const UserAgent = require('user-agents');

exports.scrape = async () => {
    const browser = await puppeteer.launch({ headless: false });
    //const context = await browser.createIncognitoBrowserContext();
    const page = await browser.newPage();

    const firstUserAgent = new UserAgent();
    const userAgent = firstUserAgent.random();

    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36");

    var urls = await getpropertiesurls(page, '32205');

    console.log('url: ', urls);
    console.log('len: ', urls.length);
    browser.close();
}

async function getpropertiesurls(page, searchkey) {
    await page.goto(`https://www.zillow.com/homes/for_sale/${searchkey}_rb/`);

    await page.waitForSelector('div.search-pagination ul li.PaginationNumberItem-c11n-8-10-0__bnmlxt-0 a', { visible: true });
    var urls = pageurls(page, [], 1, 1);


    //const ul = await page.$$('div#grid-search-results ul li');
    return urls;
}

async function pageurls(page, urls, pnumber, max) {
    console.log(`run: nam-${pnumber} max-${max}`);
    var p = await page.evaluate(() => {
        var pa = document.querySelectorAll('div.search-pagination ul li.PaginationNumberItem-c11n-8-10-0__bnmlxt-0 a');
        var arr = [];
        pa.forEach(e => arr.push({ page: parseInt(e.innerText), href: e.getAttribute('href') }));
        return arr;
    });
    for (let i = 0; i < p.length; i++) {
        const e = p[i];
        if (e.page == pnumber) {
            await page.goto(`https://www.zillow.com${e.href}`);
            console.log('href: ', e.href);
            break;
        }
    }

    await page.waitForSelector('div.search-pagination ul li.PaginationNumberItem-c11n-8-10-0__bnmlxt-0 a', { visible: true });
    p = await page.evaluate(() => {
        var pa = document.querySelectorAll('div.search-pagination ul li.PaginationNumberItem-c11n-8-10-0__bnmlxt-0 a');
        var arr = [];
        pa.forEach(e => arr.push({ page: parseInt(e.innerText), href: e.getAttribute('href') }));
        return arr;
    });
    max = p[p.length - 1].page;

    const u = await page.evaluate(async () => {
        var arr = [];
        const uiElement = document.querySelector('#grid-search-results ul');
        const li = uiElement.querySelectorAll('li a.list-card-link.list-card-link-top-margin.list-card-img');

        li.forEach(e => {
            var tmp = e.getAttribute('href');
            arr.push(tmp);
        });
        return arr;
    });

    if (max == pnumber)
        return u;
    var tmp = pnumber + 1;
    var urls = await pageurls(page, urls, tmp, max);
    return urls.concat(u);
}