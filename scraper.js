const puppeteer = require('puppeteer-extra');
const pluginStealth = require('puppeteer-extra-plugin-stealth')
const fs = require('fs');
const solve = require('./solver');

const ua = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/86.0.4240.93 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 10; SM-A705FN) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.185 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 10; SM-A305F Build/QP1A.190711.020; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/86.0.4240.114 Mobile Safari/537.36 GSA/11.30.9.21.arm64'
];

const banList = ['vacantland', 'apartment', 'condo', 'manufactured'];

exports.scrape = async (keysearch) => {
    //'--no-sandbox', '--disable-setuid-sandbox'
    puppeteer.use(pluginStealth());
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--window-size=1920,1080',
            '--no-sandbox',
            '--disable-dev-shm-usage',
        ],
        defaultViewport: null
    });

    const page = await browser.newPage();
    //page.on('console', consoleObj => console.log(consoleObj.text()));
    await page.setUserAgent(ua[0]);
    page.setDefaultNavigationTimeout(0);

    console.log('getting links...');
    var urls = await getpropertiesurls(page, '32205');
    console.log(`found ${urls.length} links, getting data start...`);
    const p = await urlstoproperties(page, urls);
    await browser.close();
    return p;
}

async function getpropertiesurls(page, searchkey) {
    await page.goto(`https://www.zillow.com/homes/for_sale/${searchkey}_rb/`);

    await page.waitForSelector('div.search-pagination ul li.PaginationNumberItem-c11n-8-10-0__bnmlxt-0 a', { visible: true });
    var urls = pageurls(page, [], 1, 1);

    return urls;
}

async function pageurls(page, urls, pnumber, max) {
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
            //console.log('href: ', e.href);
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
    //console.log(url);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 0 });
    const u = await page.url();
    console.log('url: ', u);
    if (u.toLowerCase().indexOf('captcha') != -1) {
        console.warn('Warning: recaptcha, retrying...');
        await solve(page);

        await page.waitForNavigation({ waitUntil: 'networkidle0' })
        const cu = await page.url();
        console.log('== current url: ', cu);
    };

    const sel = '#ds-container > div.ds-media-col.ds-media-col-hidden-mobile'
    const res = await page.waitForSelector(sel, { visible: true, timeout: 20000 }).catch((e) => {
        console.error('Could not load selector, retrying...');
        return 'error';
    });

    if (res == 'error') {
        const cu = await page.url();
        if (cu == url) {
            await page.goto(url, { waitUntil: 'networkidle0', timeout: 0 });
            const r = await page.waitForSelector(sel, { visible: true, timeout: 20000 }).then(() => {
                return true;
            }).catch(e => {
                return 'error';
            });
            if (r == 'error') return undefined;
        }
    }


    try {

        // ==== get facts and features ====
        const faf = await getfactsandfeatures(page);

        if(isBan(faf.spec.general.type)) { console.log('Ban - skip property'); return 'skip'; }

        // ==== get images ====
        const images = await getimages(page);

        // ==== get bedrooms, bathrooms, size, address ====
        const header = await getheader(page);

        // ==== get overview ====
        const ov = await getoverview(page);

        //==== get price history ====
        const ph = await getpricehistory(page);

        return {
            zurl: url,
            images: images,
            address: header.address,
            general: {
                bedrooms: faf.bedrooms,
                bathrooms: faf.bathrooms,
                size: faf.size,
                salestatus: header.salestatus,
                price: header.price,
                daysonmarket: ov.daysonmarket
            },
            description: ov.description,
            specs: faf.spec,
            pricehistory: ph
        };
    }
    catch (e) {
        console.log(`== getpropertyjson() url: ${url}, \n== error: ` + e);
        return undefined;
    }
}

async function getimages(page) {

    await page.evaluate(() => {
        const selq = '#ds-container > div.ds-media-col.ds-media-col-hidden-mobile ul li';
        let lis = document.querySelectorAll(selq);

        for (let i = 0; i < lis.length; i++) {
            const el = lis[i];
            setTimeout(() => {
                el.scrollIntoView({ behavior: "smooth", block: "end", inline: "end" });
            }, 10);
        }
        setTimeout(() => {
            const selector = '#ds-container > div.ds-media-col.ds-media-col-hidden-mobile';
            const elem = document.querySelector(selector);
            elem.scrollTop = elem.scrollHeight;
            console.log('== hight: ', elem.scrollHeight);
        }, 30)
    });
    try {
        await page.waitForSelector('#ds-container ul li figure').catch(e => {
            console.warn('Warning: not all image loaded');
            console.log(e);
        });
    }
    catch (error) {
        console.warn('Warning: not all image loaded');
        console.log(error);

    }
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

async function getheader(page) {
    const res = await page.evaluate(() => {
        const price = document.querySelector('#ds-container div.ds-summary-row-container div h3 span.ds-value').innerText.replace(/[^0-9]+/g, "");

        const salestatus = document.querySelector('#ds-container div.ds-data-col.ds-white-bg.ds-data-col-data-forward div.ds-chip div.sc-oUcyK.lbUOdM.ds-chip-removable-content span.sc-pzMyG.ijxQnZ.ds-status-details').innerText;

        const add1 = document.querySelector('#ds-container header > h1.ds-address-container > span:nth-child(1)').innerText;
        const add2 = document.querySelector('#ds-container header > h1.ds-address-container > span:nth-child(2)').innerText;

        return {
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
    return res;
}

async function getoverview(page) {
    const sel = '#ds-data-view ul div.ds-expandable-card-section-default-padding div.ds-overview-section div'
    await page.waitForSelector(sel, { visible: true });
    const ov = await page.evaluate(() => {
        let des = document.querySelector('#ds-data-view ul div.ds-expandable-card-section-default-padding div.ds-overview-section div').innerText;
        let dom = document.querySelector('#ds-data-view ul div.ds-expandable-card-section-default-padding div.sc-pCPXO.hbUalv div.Text-aiai24-0.bBtYeM').innerText;
        let sellerdes = document.querySelector('#ds-data-view ul div.ds-expandable-card-section-default-padding div.Text-aiai24-0.sc-pZnSc.iCEFOv');
        var res = {
            description: des,
            daysonmarket: parseInt(dom.replace(/[^0-9]+/g, ""))
        };
        if (sellerdes != null && des != sellerdes.innerText) res.sellerdes = sellerdes.innerText;
        return res;
    });
    return ov;
}

async function getfactsandfeatures(page) {
    await page.evaluate(() => {
        let el = document.querySelectorAll('div#ds-container nav.mg5mjz-4.cdyiUb a');
        el[1].click();

        let btn = document.querySelector('div#ds-data-view footer');
        btn.scrollIntoView();
        btn.click();
    });

    const faf = await page.evaluate(() => {
        // ==== helper function ====
        function trimdot(str) {
            let dots = str.indexOf(':') + 1;;
            return str.substring(dots).trim();
        }

        function getval(ul, feature) {
            for (let i = 0; i < ul.length; i++) {
                const e = ul[i];
                let span = e.querySelector('span').innerText;
                let tmp = span.replace(/\s+/g, '');
                if (tmp.toLowerCase().indexOf(feature) != -1) {
                    return trimdot(span);
                }
            }
            return undefined;
        }
        //===========================

        //general info 
        var type, yearbuiled, sewer, watersource, size;

        // Interior details
        var heating, cooling, flooring, appliances, stories, basement, extra, bedrooms, bathrooms;

        // Exterior details 
        var exmaterial, parking, roof, conmaterial, foundation, lot;

        let div = document.querySelectorAll('div#ds-data-view ul li div.sc-puFaA.lnNxfr div.sc-pAMyN.hdvvgV');
        for (let i = 0; i < div.length; i++) {
            const elm = div[i];
            let tmp = elm.querySelector('span.Text-aiai24-0.bBtYeM').innerText.toLowerCase();
            let ul = elm.querySelectorAll('ul li');

            switch (tmp) {
                //general info
                case 'type and style':
                    type = getval(ul, 'hometype');
                    break;
                case 'condition':
                    yearbuiled = getval(ul, 'yearbuilt');
                    break;
                case 'utility':
                    sewer = getval(ul, 'sewerinformation');
                    break;
                case 'other interior features':
                    size = parseInt(getval(ul, 'totalinteriorlivablearea').replace(/[^0-9]+/g, ""));
                    break;

                // Interior details
                case 'bedrooms and bathrooms':
                    bedrooms = parseInt(getval(ul, 'bedrooms'));
                    bathrooms = parseInt(getval(ul, 'bathrooms'));
                    break;
                case 'cooling':
                    cooling = getval(ul, 'coolingfeatures');
                    break;
                case 'heating':
                    heating = getval(ul, 'heatingfeatures');
                    break;
                case 'flooring':
                    let t = getval(ul, 'flooring');
                    if (t = undefined && t.toLowerCase() != 'other') flooring = t;
                    break;
                case 'appliances':
                    let at = getval(ul, 'appliancesincluded');
                    if (at != undefined) appliances = at.split(', ');
                    break;

                // Exterior details 
                case 'property':
                    exmaterial = getval(ul, 'exteriorfeatures');
                    stories = parseInt(getval(ul, 'stories'));
                    break;
                case 'parking':
                    parking = getval(ul, 'parkingfeatures');
                    break;
                case 'material information':
                    conmaterial = getval(ul, 'constructionmaterials');
                    foundation = getval(ul, 'foundation');
                    let mt = getval(ul, 'roof');
                    if (mt != undefined && mt.toLowerCase() != 'other') matroof = mt;
                    break;
                case 'lot':
                    lot = getval(ul, 'lotsize');
                    break;
            }
        }

        //Other facts
        const otherFacts = document.querySelectorAll('div#ds-data-view div.sc-puFaA.lnNxfr div.sc-pAMyN.iOhXWD ul li');

        roof = getval(otherFacts, 'roof');
        basement = getval(otherFacts, 'basement');
        watersource = getval(otherFacts, 'watersource');
        let et = getval(otherFacts, 'interiorfeatures');
        if (et != undefined) extra = et.split(', ');

        return {
            size: size,
            bathrooms: bathrooms,
            bedrooms: bedrooms,
            spec: {
                general: {
                    type: type,
                    yearbuiled: parseInt(yearbuiled),
                    sewer: sewer,
                    watersource: watersource
                },
                interiordetails: {
                    heating: heating,
                    cooling: cooling,
                    flooring: flooring,
                    appliances: appliances,
                    stories: stories,
                    basement: basement,
                    extra: extra
                },
                exteriordetails: {
                    parking: parking,
                    foundation: foundation,
                    exteriormaterial: exmaterial,
                    constructionmaterials: conmaterial,
                    roofmaterial: roof,
                    lot: lot
                }
            }
        }
    });
    return faf;
}

async function getpricehistory(page) {
    const ph = await page.evaluate(() => {
        const table = document.querySelector('div#ds-data-view div.sc-1ezbn92-4.cZFcDZ table.sc-1ezbn92-2.hxLCYs');

        if (table == null || table == undefined) return undefined;
        const tfoot = table.querySelector('tfoot button');

        if (tfoot != undefined) {
            tfoot.click();
            tfoot.scrollIntoView({ behavior: "smooth", block: "end", inline: "end" });
        }

        const tr = table.querySelectorAll('tbody tr.sc-1ezbn92-3.sc-1ezbn92-6.iZtLmp');

        var phl = [];
        tr.forEach(e => {
            const tds = e.querySelectorAll('td span.sc-1ezbn92-20.mEqIW');
            let date = tds[0].innerText;
            let d = new Date(date);
            let event = tds[1].innerText;
            let price = parseInt(tds[2].innerText.replace(/[^0-9]+/g, ""));
            if (price == null) price = undefined;
            phl.push({
                date: d.getTime(),
                event: event,
                price: price
            });
        });
        return phl;
    });
    return ph;
}

async function urlstoproperties(page, urls) {
    const properties = [];
    var scount = 0;
    for (let i = 0; i <  35/*urls.length*/; i++) {
        const e = urls[i];
        let tmp = await getpropertyjson(page, e);
        if (tmp != undefined && tmp != 'skip')
            properties.push(tmp);
        else if(tmp == 'skip')
        scount++;
    }
    console.log('writing to file...')
    fs.writeFileSync('lastrun.json', JSON.stringify(properties));
    console.log(`done getting properties. --success: ${properties.length} --,   --failed: ${(urls.length - properties.length)} --,  -- skiped: ${scount} --`);
    return properties;
}

function isBan(type){
    for (let i = 0; i < banList.length; i++) {
        const e = banList[i];
        if(e == type.toLowerCase().replace(/\s+/g, ''))
            return true;
    }
    return false;
}