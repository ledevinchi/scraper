const puppeteer = require('puppeteer');
const UserAgent = require('user-agents');

exports.scrape = async () => {
    const browser = await puppeteer.launch({ headless: false, args: [`--window-size=1920,1080`], defaultViewport: null });
    //args: [`--window-size=800,800`], defaultViewport: null
    //const context = await browser.createIncognitoBrowserContext();
    const page = await browser.newPage();



    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36");

    //var urls = await getpropertiesurls(page, '32205');

    //var tmpurl = 'https://www.zillow.com/homedetails/13-Gardenvale-Dr-Cheektowaga-NY-14225/30284764_zpid/';
    //var tmpurl = "https://www.zillow.com/homedetails/27-Dorothy-Ave-Rochester-NY-14615/30848328_zpid/";

    //var tmpurl = 'https://www.zillow.com/homedetails/906-Greenridge-Rd-Jacksonville-FL-32207/44483311_zpid/'
    //var tmpurl = 'https://www.zillow.com/homedetails/2973-Riverside-Ave-Jacksonville-FL-32205/44479421_zpid/';
    //var tmpurl = "https://www.zillow.com/homedetails/1427-Rensselaer-Ave-Jacksonville-FL-32205/44489389_zpid/";
    var tmpurl = "https://www.zillow.com/homedetails/1552-E-11th-St-Jacksonville-FL-32206/44519429_zpid/";
    const p = await getpropertyjson(page, tmpurl);
    console.log('========================');
    console.log('property: ', p);
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
    const sel = '#ds-container > div.ds-media-col.ds-media-col-hidden-mobile > ul li img'
    await page.waitForSelector(sel, { visible: true });

    // ==== get images ====
    const images = await getimages(page);
    console.log('imgs: ', images);

    // ==== get bedrooms, bathrooms, size, address ====
    const header = await getheader(page);
    console.log('header: ', header);

    // ==== get overview ====
    const ov = await getoverview(page);
    console.log('overview: ', ov);

    // ==== get facts and features ====
    const faf = await getfactsandfeatures(page);
    console.log('facts: ', faf);

    //==== get price history ====
    const ph = await getpricehistory(page);
    console.log('price history: ', ph);

    return {
        images: images,
        address: header.address,
        general:{
            bedrooms: header.bedrooms,
            bathrooms: header.bathrooms,
            size: header.size,
            salestatus: header.salestatus,
            price: header.price,
            daysonmarket: ov.daysonmarket
        },
        description: ov.description,
        specs: faf,
        pricehistory: ph
    };
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

async function getheader(page) {
    const res = await page.evaluate(() => {
        const bd = document.querySelector('#ds-container header.ds-bed-bath-living-area-header > h3 > span:nth-child(1) > span:nth-child(1)').innerText;
        const ba = document.querySelector('#ds-container header.ds-bed-bath-living-area-header > h3 > button > span > span:nth-child(1)').innerText;
        const sqf = document.querySelector('#ds-container header.ds-bed-bath-living-area-header > h3 > span:nth-child(5) > span:nth-child(1)').innerText;

        const price = document.querySelector('#ds-container div.ds-summary-row-container div h3 span.ds-value').innerText.replace(/[^0-9]+/g, "");

        const salestatus = document.querySelector('#ds-container > div.ds-data-col.ds-white-bg.ds-data-col-data-forward > div.ds-chip > div > div.sc-oUcyK.lbUOdM.ds-chip-removable-content > p > span.sc-pzMyG.ijxQnZ.ds-status-details').innerText;

        const add1 = document.querySelector('#ds-container header > h1.ds-address-container > span:nth-child(1)').innerText;
        const add2 = document.querySelector('#ds-container header > h1.ds-address-container > span:nth-child(2)').innerText;

        return {
            bedrooms: parseInt(bd),
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

    // const sel = '#ds-data-view > ul > li:nth-child(5) > div > div > div.sc-19crqy3-4.hKgoUm > div:nth-child(1) > div > div:nth-child(2) > ul > li > span'
    // await page.waitForSelector(sel, { visible: true });
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
        var type, yearbuiled, sewer, watersource;

        // Interior details
        var heating, cooling, flooring, appliances, stories, basement, extra;

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

                // Interior details
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
        };
    });
    return faf;
}

async function getpricehistory(page) {
    const ph = await page.evaluate(() => {
        const table = document.querySelector('div#ds-data-view div.sc-1ezbn92-4.cZFcDZ table.sc-1ezbn92-2.hxLCYs');

        const tfoot = table.querySelector('tfoot button');

        if(tfoot != undefined){
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
            if(price == null) price = undefined;
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
