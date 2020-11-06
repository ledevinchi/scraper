const scraper = require('./scraper');

var urls = scraper.scrape('14609', 5, (p) => {
    //console.log('tmp: ', p.address.street);
});