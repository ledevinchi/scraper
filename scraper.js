const puppeteer = require('puppeteer');
const UserAgent = require('user-agents');

exports.scrape = async () => {
    const browser = await puppeteer.launch({ headless: false, args: [`--window-size=1920,1080`], defaultViewport: null });
    //args: [`--window-size=800,800`], defaultViewport: null
    //const context = await browser.createIncognitoBrowserContext();
    const page = await browser.newPage();



    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36");

    //var urls = await getpropertiesurls(page, '32205');

    var tmpurl = 'https://www.zillow.com/homedetails/906-Greenridge-Rd-Jacksonville-FL-32207/44483311_zpid/'
    //var tmpurl = 'https://www.zillow.com/homedetails/2973-Riverside-Ave-Jacksonville-FL-32205/44479421_zpid/';
    //var tmpurl = "https://www.zillow.com/homedetails/3658-Walsh-St-Jacksonville-FL-32205/44489188_zpid/";
    await getpropertyjson(page, tmpurl);

    //console.log('url: ', urls);
    //console.log('len: ', urls.length);
    browser.close();
}

async function getpropertiesurls(page, searchkey) {
    await page.goto(`https://www.zillow.com/homes/for_sale/${searchkey}_rb/`);

    await page.waitForSelector('div.search-pagination ul li.PaginationNumberItem-c11n-8-10-0__bnmlxt-0 a', { visible: true });
    var urls = pageurls(page, [], 1, 1);

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

async function getpropertyjson(page, url) {
    console.log('url: ', url);
    await page.goto(url, { waitUntil: 'networkidle0', });

    // ==== get images ====
    // const sel = '#ds-container > div.ds-media-col.ds-media-col-hidden-mobile > ul li img'
    // await page.waitForSelector(sel, { visible: true });
    // var images = await getimages(page);

    // ==== get badrooms, bathrooms, size, address ====
    const bb = await getheader(page);

}

async function getheader(page) {
    //badrooms
    const res = await page.evaluate(() => {
        const bd = document.querySelector('#ds-container header.ds-bed-bath-living-area-header > h3 > span:nth-child(1) > span:nth-child(1)').innerText;
        const ba = document.querySelector('#ds-container header.ds-bed-bath-living-area-header > h3 > button > span > span:nth-child(1)').innerText;
        const sqf = document.querySelector('#ds-container header.ds-bed-bath-living-area-header > h3 > span:nth-child(5) > span:nth-child(1)').innerText;

        const price = document.querySelector('#ds-container div.ds-summary-row-container div h3 span.ds-value').innerText.replace(/[^0-9]+/g, "");

        const salestatus = document.querySelector('#ds-container > div.ds-data-col.ds-white-bg.ds-data-col-data-forward > div.ds-chip > div > div.sc-oUcyK.lbUOdM.ds-chip-removable-content > p > span.sc-pzMyG.ijxQnZ.ds-status-details').innerText;

        const add1 = document.querySelector('#ds-container header > h1.ds-address-container > span:nth-child(1)').innerText;
        const add2 = document.querySelector('#ds-container header > h1.ds-address-container > span:nth-child(2)').innerText;

        return {
            badrooms: parseInt(bd),
            bathrooms: parseInt(ba),
            size: parseInt(sqf.replace(',', '')),
            price: parseInt(price),
            salestatus: salestatus,
            address: {
                add1: add1,
                add2: add2
            }
        }
    });

    let citystatezip = res.address.add2.split(',');
    let statezip = citystatezip[1].trim().split(' ');

    var address = {
        street: res.address.add1.replace(',', '').trim(),
        city: citystatezip[0].trim(),
        state: statezip[0].trim(),
        zipcode: statezip[1].trim()
    }
    res.address = address;
    console.log(res);
    return res;
}

async function getimages(page) {

    const lilen = await page.evaluate(() => {
        const selq = '#ds-container > div.ds-media-col.ds-media-col-hidden-mobile ul li';
        let lis = document.querySelectorAll(selq);

        for (let i = 0; i < lis.length; i++) {
            const el = lis[i];
            setTimeout(() => {
                el.scrollIntoView({ behavior: "smooth", block: "end", inline: "end" });
            }, 10);
        }
        const selector = '#ds-container > div.ds-media-col.ds-media-col-hidden-mobile';
        const elem = document.querySelector(selector);
        elem.scrollTop = elem.scrollHeight;

        return elem.scrollHeight;
    });

    await page.waitForSelector('#ds-container > div.ds-media-col.ds-media-col-hidden-mobile > ul li figure');

    const imgs = await page.evaluate(() => {
        const sel = '#ds-container > div.ds-media-col.ds-media-col-hidden-mobile > ul > li button img';
        var im = document.querySelectorAll(sel);
        var arr = [];
        im.forEach(e => {
            e.scrollIntoView();
            arr.push(e.getAttribute('src'));
        });
        return arr;
    });
    return imgs;
}
