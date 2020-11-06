const puppeteer = require('puppeteer');
const fs = require('fs');

const ua = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/86.0.4240.93 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 10; SM-A705FN) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.185 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 10; SM-A305F Build/QP1A.190711.020; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/86.0.4240.114 Mobile Safari/537.36 GSA/11.30.9.21.arm64'
];

const banList = ['vacantland', 'apartment', 'condo', 'manufactured'];

exports.scrape = async (keysearch, maxResults, callback) => {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--window-size=1920,1080',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security'
        ],
        defaultViewport: null
    });

    const page = await browser.newPage();
    //await page.setRequestInterception(true);


    // page.on('request', req => {
    //     //const wl = ['document', 'xhr', 'script', 'fetch', 'text/plain', 'websocket'];
    //     const bl = ['gif', 'png', 'jpeg', 'svg+xml',];
    //     if (bl.includes(req.resourceType())) {
    //         return req.abort();
    //     }
    //     req.continue();
    // });
    // const reses = [];
    // page.on('response', async (res) => {
    //     if (res.url().indexOf('graphql') != -1)
    //         reses.push({
    //             url: res.url(),
    //             header: res.headers(),
    //             request: res.request(),
    //             json: await res.json().catch(e => {return { } }),     
    //         });
    // });


    //page.on('console', consoleObj => console.log(consoleObj.text()));
    await page.setUserAgent(ua[0]);
    //page.setDefaultNavigationTimeout(0);

    const testArr = ['4436023', '44514477', '44525176', '44477743'];
    const test = await getProperty(page, testArr[0]);
    //console.log(test);

    // console.log('getting links...');
    // var urls = await getpropertiesurls(page, keysearch);
    // if (maxResults != undefined) urls = urls.slice(0, maxResults);

    //await page.goto('https://www.zillow.com/homedetails/682-Bridal-Ave-Jacksonville-FL-32205/44480127_zpid/', { waitUntil: 'networkidle0', timeout: 0 })

    await browser.close();
    fs.writeFileSync('responses.json', test);
    return [];
}


async function getProperty(page, url) {
    const id = urlToId(url);
    await page.goto(`https://zscraper.000webhostapp.com/?zid=${id}`, { waitUntil: 'load', timeout: 0 });
    sleep(1000);
    const tmp =  await page.evaluate(async() => {
        return await getproperty.then(data => { return data }).catch(e => {return e});
    });
    const prop = JSON.parse(tmp).data.property;
    let images = toImageArray(prop.hugePhotos);
    console.log(images)
    return prop;
    // return {
    //     zurl: url,
    //     images: images,
    //     address: header.address,
    //     general: {
    //         bedrooms: faf.bedrooms,
    //         bathrooms: faf.bathrooms,
    //         size: faf.size,
    //         salestatus: header.salestatus,
    //         price: header.price,
    //         daysonmarket: ov.daysonmarket
    //     },
    //     description: ov.description,
    //     specs: {
    //         general: {
    //             type: type,
    //             yearbuiled: parseInt(yearbuiled),
    //             sewer: sewer,
    //             watersource: watersource
    //         },
    //         interiordetails: {
    //             heating: heating,
    //             cooling: cooling,
    //             flooring: flooring,
    //             appliances: appliances,
    //             stories: stories,
    //             basement: basement,
    //             extra: extra
    //         },
    //         exteriordetails: {
    //             parking: parking,
    //             foundation: foundation,
    //             exteriormaterial: exmaterial,
    //             constructionmaterials: conmaterial,
    //             roofmaterial: roof,
    //             lot: lot
    //         }
    //     },
    //     pricehistory: []
    // }
}



function toImageArray(obj){
    const arr = [];

    for (let i = 0; i < obj.length; i++) {
        const e = obj[i];
        arr.push(e.url);
    }
    return arr;
}







// get properties  urls
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
//end get properties urls


async function urlstoproperties(page, urls, callback) {
    const properties = [];
    const failedProperties = [];
    var scount = 0;
    for (let i = 0; i < urls.length; i++) {
        const e = urls[i];
        let tmp = await getpropertyjson(page, e, i);
        if (tmp != undefined && tmp != 'skip' && tmp.failedUrl == undefined) {
            properties.push(tmp);
            callback(tmp);
        }
        else if (tmp == 'skip') scount++;
        else if (tmp != undefined && tmp.failedUrl != undefined) failedProperties.push(tmp.failedUrl);
    }

    if (failedProperties.length != 0) {
        console.log(`done, retrying ${failedProperties.length} faild properties...`);
        for (let i = 0; i < failedProperties.length; i++) {
            const e = failedProperties[i];
            let tmp = await getpropertyjson(page, e, i);
            if (tmp != undefined && tmp != 'skip' && tmp.failedUrl == undefined) {
                properties.push(tmp);
                callback(tmp);
            }
            else if (tmp == 'skip') scount++;
        }
    }


    console.log('writing to file...')
    fs.writeFileSync('lastrun.json', JSON.stringify(properties));
    console.log(`done getting properties. --success: ${properties.length} --,   --failed: ${(urls.length - (properties.length + scount))} --,  -- skiped: ${scount} --`);
    return properties;
}




//==================
function isBan(type) {
    for (let i = 0; i < banList.length; i++) {
        const e = banList[i];
        if (e == type.toLowerCase().replace(/\s+/g, ''))
            return true;
    }
    return false;
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function urlToId(str) {
    var indexOfZipID = str.lastIndexOf("_zpid/");
    var res = str.slice(0, indexOfZipID);

    return res.slice(res.lastIndexOf("/") + 1, res.length);

}