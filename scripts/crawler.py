#!/usr/bin/env python
# -*- coding: UTF-8 -*-
'''
Self contained script to crawl a bunch of websites with Privacy Badger
installed and dump the data.

This requires some manual editing to make it do what you want. Set you list of
desired urls as a variable name `urls`. Add any functions for dumping data in
the `dump_data` function (it has examples in it). See the
`if __name__ == '__main__':` block to see how to run the script.
'''

from ipdb import set_trace
from pprint import pprint
from glob import glob
import os
import subprocess
import json
from time import sleep
from contextlib import contextmanager

from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.chrome.options import Options

'''
a list of 500 popular urls
'''
urls_500 = [
    'http://facebook.com',
    'http://twitter.com',
    'http://google.com',
    'http://youtube.com',
    'http://linkedin.com',
    'http://wordpress.org',
    'http://instagram.com',
    'http://pinterest.com',
    'http://hugedomains.com',
    'http://sedo.com',
    'http://wikipedia.org',
    'http://sedoparking.com',
    'http://blogspot.com',
    'http://adobe.com',
    'http://apple.com',
    'http://wordpress.com',
    'http://godaddy.com',
    'http://tumblr.com',
    'http://amazon.com',
    'http://vimeo.com',
    'http://youtu.be',
    'http://yahoo.com',
    'http://flickr.com',
    'http://microsoft.com',
    'http://goo.gl',
    'http://bit.ly',
    'http://buydomains.com',
    'http://qq.com',
    'http://whoisprivacyprotect.com',
    'http://weebly.com',
    'http://w3.org',
    'http://networkadvertising.org',
    'http://reddit.com',
    'http://nytimes.com',
    'http://baidu.com',
    'http://ascii.co.uk',
    'http://vk.com',
    'http://statcounter.com',
    'http://blogger.com',
    'http://t.co',
    'http://bbc.co.uk',
    'http://myspace.com',
    'http://parallels.com',
    'http://addthis.com',
    'http://europa.eu',
    'http://bluehost.com',
    'http://soundcloud.com',
    'http://wix.com',
    'http://gov.uk',
    'http://feedburner.com',
    'http://cnn.com',
    'http://github.com',
    'http://jimdo.com',
    'http://google.de',
    'http://yandex.ru',
    'http://digg.com',
    'http://mozilla.org',
    'http://huffingtonpost.com',
    'http://stumbleupon.com',
    'http://123-reg.co.uk',
    'http://issuu.com',
    'http://creativecommons.org',
    'http://wsj.com',
    'http://miibeian.gov.cn',
    'http://ovh.net',
    'http://go.com',
    'http://imdb.com',
    'http://nih.gov',
    'http://secureserver.net',
    'http://theguardian.com',
    'http://forbes.com',
    'http://msn.com',
    'http://weibo.com',
    'http://paypal.com',
    'http://slideshare.net',
    'http://google.co.jp',
    'http://miitbeian.gov.cn',
    'http://washingtonpost.com',
    'http://wp.com',
    'http://dropbox.com',
    'http://domainactive.co',
    'http://amazonaws.com',
    'http://yelp.com',
    'http://eventbrite.com',
    'http://ebay.com',
    'http://typepad.com',
    'http://telegraph.co.uk',
    'http://addtoany.com',
    'http://reuters.com',
    'http://macromedia.com',
    'http://sourceforge.net',
    'http://etsy.com',
    'http://about.com',
    'http://free.fr',
    'http://usatoday.com',
    'http://ameblo.jp',
    'http://dailymail.co.uk',
    'http://archive.org',
    'http://constantcontact.com',
    'http://aol.com',
    'http://livejournal.com',
    'http://google.co.uk',
    'http://fc2.com',
    'http://time.com',
    'http://bing.com',
    'http://icio.us',
    'http://amazon.co.uk',
    'http://mail.ru',
    'http://latimes.com',
    'http://yahoo.co.jp',
    'http://eepurl.com',
    'http://51.la',
    'http://guardian.co.uk',
    'http://npr.org',
    'http://cpanel.net',
    'http://harvard.edu',
    'http://surveymonkey.com',
    'http://taobao.com',
    'http://1und1.de',
    'http://bloomberg.com',
    'http://xing.com',
    'http://wikimedia.org',
    'http://e-recht24.de',
    'http://cdc.gov',
    'http://cpanel.com',
    'http://amazon.de',
    'http://hostnet.nl',
    'http://mit.edu',
    'http://dailymotion.com',
    'http://bbb.org',
    'http://live.com',
    'http://wired.com',
    'http://stanford.edu',
    'http://list-manage.com',
    'http://joomla.org',
    'http://webs.com',
    'http://hatena.ne.jp',
    'http://blogspot.co.uk',
    'http://one.com',
    'http://domainname.ru',
    'http://elegantthemes.com',
    'http://delicious.com',
    'http://apache.org',
    'http://bandcamp.com',
    'http://163.com',
    'http://kickstarter.com',
    'http://networksolutions.com',
    'http://amzn.to',
    'http://homestead.com',
    'http://rambler.ru',
    'http://tripadvisor.com',
    'http://nasa.gov',
    'http://cnet.com',
    'http://ovh.com',
    'http://gnu.org',
    'http://businessinsider.com',
    'http://scribd.com',
    'http://geocities.com',
    'http://independent.co.uk',
    'http://photobucket.com',
    'http://bbc.com',
    'http://disqus.com',
    'http://amazon.co.jp',
    'http://ted.com',
    'http://un.org',
    'http://imgur.com',
    'http://pbs.org',
    'http://trustpilot.com',
    'http://domainname.de',
    'http://google.fr',
    'http://adition.com',
    'http://opera.com',
    'http://behance.net',
    'http://cbsnews.com',
    'http://mashable.com',
    'http://tripod.com',
    'http://wiley.com',
    'http://who.int',
    'http://deviantart.com',
    'http://googleusercontent.com',
    'http://ibm.com',
    'http://ca.gov',
    'http://nationalgeographic.com',
    'http://whitehouse.gov',
    'http://berkeley.edu',
    'http://barnesandnoble.com',
    'http://hibu.com',
    'http://foxnews.com',
    'http://theatlantic.com',
    'http://google.ca',
    'http://mijndomein.nl',
    'http://loopia.se',
    'http://google.es',
    'http://sohu.com',
    'http://techcrunch.com',
    'http://namejet.com',
    'http://rakuten.co.jp',
    'http://loopia.com',
    'http://github.io',
    'http://visma.com',
    'http://goodreads.com',
    'http://nature.com',
    'http://spotify.com',
    'http://medium.com',
    'http://cornell.edu',
    'http://buzzfeed.com',
    'http://usda.gov',
    'http://google.it',
    'http://ft.com',
    'http://ifeng.com',
    'http://squarespace.com',
    'http://technorati.com',
    'http://wixsite.com',
    'http://engadget.com',
    'http://epa.gov',
    'http://cbc.ca',
    'http://sciencedirect.com',
    'http://sakura.ne.jp',
    'http://doubleclick.net',
    'http://blogspot.com.es',
    'http://change.org',
    'http://noaa.gov',
    'http://economist.com',
    'http://name.com',
    'http://bizjournals.com',
    'http://php.net',
    'http://1and1.fr',
    'http://sfgate.com',
    'http://gravatar.com',
    'http://loc.gov',
    'http://ow.ly',
    'http://sogou.com',
    'http://vkontakte.ru',
    'http://detik.com',
    'http://prnewswire.com',
    'http://meetup.com',
    'http://blogspot.de',
    'http://nps.gov',
    'http://usnews.com',
    'http://chicagotribune.com',
    'http://businessweek.com',
    'http://springer.com',
    'http://slate.com',
    'http://histats.com',
    'http://1and1.com',
    'http://umblr.com',
    'http://newyorker.com',
    'http://cbslocal.com',
    'http://spiegel.de',
    'http://baiyewang.com',
    'http://abc.net.au',
    'http://themeforest.net',
    'http://about.me',
    'http://nydailynews.com',
    'http://hp.com',
    'http://list-manage1.com',
    'http://myshopify.com',
    'http://100ye.com',
    'http://wikia.com',
    'http://umich.edu',
    'http://google.com.au',
    'http://marriott.com',
    'http://xinhuanet.com',
    'http://wufoo.com',
    'http://webmd.com',
    'http://mapquest.com',
    'http://ustream.tv',
    'http://rs6.net',
    'http://foursquare.com',
    'http://fda.gov',
    'http://cnbc.com',
    'http://house.gov',
    'http://salenames.ru',
    'http://away.ru',
    'http://homes.ru',
    'http://promopages.ru',
    'http://home.pl',
    'http://yale.edu',
    'http://state.gov',
    'http://columbia.edu',
    'http://ed.gov',
    'http://phpbb.com',
    'http://nbcnews.com',
    'http://jiathis.com',
    'http://bigcartel.com',
    'http://acquirethisname.com',
    'http://wp.me',
    'http://cloudfront.net',
    'http://unesco.org',
    'http://ocn.ne.jp',
    'http://gizmodo.com',
    'http://skype.com',
    'http://fb.me',
    'http://upenn.edu',
    'http://beian.gov.cn',
    'http://a8.net',
    'http://geocities.jp',
    'http://storify.com',
    'http://washington.edu',
    'http://people.com.cn',
    'http://businesswire.com',
    'http://livedoor.jp',
    'http://afternic.com',
    'http://domainnameshop.com',
    'http://line.me',
    'http://dreamhost.com',
    'http://senate.gov',
    'http://naver.com',
    'http://uk2.net',
    'http://vice.com',
    'http://hilton.com',
    'http://haljl.com',
    'http://domeneshop.no',
    'http://irs.gov',
    'http://zdnet.com',
    'http://doi.org',
    'http://smh.com.au',
    'http://linksynergy.com',
    'http://weather.com',
    'http://hexun.com',
    'http://booking.com',
    'http://android.com',
    'http://register.it',
    'http://fortune.com',
    'http://utexas.edu',
    'http://marketwatch.com',
    'http://theverge.com',
    'http://indiatimes.com',
    'http://wisc.edu',
    'http://hostgator.com',
    'http://fastcompany.com',
    'http://bola.net',
    'http://xiti.com',
    'http://nic.tel',
    'http://dribbble.com',
    'http://clickbank.net',
    'http://ox.ac.uk',
    'http://gstatic.com',
    'http://debian.org',
    'http://samsung.com',
    'http://ap.org',
    'http://nhs.uk',
    'http://shopify.com',
    'http://enable-javascript.com',
    'http://drupal.org',
    'http://fb.com',
    'http://mlb.com',
    'http://wunderground.com',
    'http://nazwa.pl',
    'http://worldbank.org',
    'http://census.gov',
    'http://studiopress.com',
    'http://netcraft.com',
    'http://oracle.com',
    'http://si.edu',
    'http://bestfwdservice.com',
    'http://sagepub.com',
    'http://campaign-archive1.com',
    'http://goo.ne.jp',
    'http://campaign-archive2.com',
    'http://directdomains.com',
    'http://sciencemag.org',
    'http://ranshao.com',
    'http://mozilla.com',
    'http://princeton.edu',
    'http://alexa.com',
    'http://alibaba.com',
    'http://usgs.gov',
    'http://houzz.com',
    'http://youku.com',
    'http://paginegialle.it',
    'http://telnic.org',
    'http://intel.com',
    'http://google.nl',
    'http://iqiyi.com',
    'http://mailchimp.com',
    'http://oxfordjournals.org',
    'http://ftc.gov',
    'http://prweb.com',
    'http://jdoqocy.com',
    'http://inc.com',
    'http://cam.ac.uk',
    'http://arstechnica.com',
    'http://oecd.org',
    'http://cisco.com',
    'http://politico.com',
    'http://cmu.edu',
    'http://hbr.org',
    'http://tmall.com',
    'http://redcross.org',
    'http://gofundme.com',
    'http://att.com',
    'http://t-online.de',
    'http://phoca.cz',
    'http://hhs.gov',
    'http://istockphoto.com',
    'http://uol.com.br',
    'http://icann.org',
    'http://shareasale.com',
    'http://web.de',
    'http://yellowbook.com',
    'http://dropboxusercontent.com',
    'http://plesk.com',
    'http://hubspot.com',
    'http://ewebdevelopment.com',
    'http://entrepreneur.com',
    'http://dell.com',
    'http://tandfonline.com',
    'http://zendesk.com',
    'http://cafepress.com',
    'http://aliyun.com',
    'http://smugmug.com',
    'http://nsw.gov.au',
    'http://1688.com',
    'http://usa.gov',
    'http://dandomain.dk',
    'http://cn7w.net',
    'http://china.com',
    'http://mysql.com',
    'http://stackoverflow.com',
    'http://ieee.org',
    'http://com.com',
    'http://amazon.fr',
    'http://fao.org',
    'http://aspcms.com',
    'http://eb.com.cn',
    'http://netscape.com',
    'http://venturebeat.com',
    'http://qiangmi.com',
    'http://mingyou.com',
    'http://shinystat.com',
    'http://safedog.cn',
    'http://adweek.com',
    'http://pcworld.com',
    'http://gpo.gov',
    'http://warnerbros.com',
    'http://odnoklassniki.ru',
    'http://cyberchimps.com',
    'http://google.com.hk',
    'http://shop-pro.jp',
    'http://welt.de',
    'http://cryoutcreations.eu',
    'http://hibustudio.com',
    'http://themegrill.com',
    'http://globo.com',
    'http://dot.gov',
    'http://admin.ch',
    'http://tripadvisor.co.uk',
    'http://west.cn',
    'http://nielsen.com',
    'http://accuweather.com',
    'http://state.tx.us',
    'http://bund.de',
    'http://sun.com',
    'http://sec.gov',
    'http://quantcast.com',
    'http://wn.com',
    'http://thenextweb.com',
    'http://prezi.com',
    'http://lulu.com',
    'http://windowsphone.com',
    'http://chinadaily.com.cn',
    'http://box.com',
    'http://symantec.com',
    'http://aboutcookies.org',
    'http://theregister.co.uk',
    'http://nginx.org',
    'http://tucows.com',
    'http://allaboutcookies.org',
    'http://huanqiu.com',
    'http://oreilly.com',
    'http://ebay.co.uk',
    'http://liveinternet.ru',
    'http://comsenz.com',
    'http://example.com',
    'http://pcmag.com',
    'http://xrea.com',
    'http://nike.com',
    'http://amazon.ca',
    'http://teamviewer.com',
    'http://areasnap.com',
    'http://sitemeter.com',
    'http://presscustomizr.com',
    'http://cargocollective.com',
    'http://discuz.net',
    'http://wa.gov',
    'http://google.com.br',
    'http://google.pl',
    'http://dol.gov',
    'http://youdao.com',
    'http://openstreetmap.org',
    'http://zenfolio.com',
    'http://deloitte.com',
    'http://google.co.in',
    'http://blackberry.com',
    'http://uspto.gov',
    'http://justgiving.com',
    'http://soso.com',
    'http://baike.com',
    'http://fotolia.com',
    'https://moz.com',
    'https://eff.org',
]

'''
These are likely to have localStorage supercookies
taken from:
    https://publicwww.com/websites/%22cdn.optimizely.com%22/
'''

supercookie_urls = [
    "http://nicovideo.jp/",
    "http://cnn.com/",
    "http://nytimes.com/",
    "http://espn.com/",
    "http://ladbible.com/",
    "http://wikihow.com/",
    "http://sharepoint.com/",
    "http://foxnews.com/",
    "http://office365.com/",
    "http://shopify.com/",
    "http://olx.ua/",
    "http://hulu.com/",
    "http://telegraph.co.uk/",
    "http://taboola.com/",
    "http://atlassian.net/",
    "http://sciencedirect.com/",
    "http://espncricinfo.com/",
    "http://bloomberg.com/",
    "http://upwork.com/",
    "http://box.com/",
]

base_url = "chrome-extension://mcgekeccgjgcmhnhbabplanchdogjcnh/"
background_url = base_url + "_generated_background_page.html"
storages = ['action_map', 'snitch_map', 'cookieblock_list', 'dnt_hashes', 'settings_map']

wants_xvfb = bool(os.environ.get('ENABLE_XVFB', False))
browser_name = os.environ.get('BROWSER_NAME', 'google-chrome-stable')

parse_stdout = lambda res: res.strip().decode('utf-8')
run_shell_command = lambda command: parse_stdout(subprocess.check_output(command))
get_git_root = lambda: run_shell_command(['git', 'rev-parse', '--show-toplevel'])
get_git_hash = lambda: run_shell_command(["git", "rev-parse", "HEAD"])
get_git_branch = lambda: run_shell_command(["git", "symbolic-ref", "HEAD"]).split('/')[-1]


def get_git_hash():
    return subprocess.check_output(["git", "rev-parse", "HEAD"]).strip().decode('utf-8')

def build_crx():
    '''Builds the .crx file for Chrome and returns the path to it'''
    cmd = ['make', '-sC', get_git_root(), 'travisbuild']
    return os.path.join(get_git_root(), run_shell_command(cmd).split()[-1])

def unix_which(command, silent=False):
    try:
        return run_shell_command(['which', command])
    except subprocess.CalledProcessError as e:
        if silent:
            return None
        raise e

def save_json(out_name, out_data):
    with open(out_name, 'w') as f:
        f.write(json.dumps(out_data, indent=4, sort_keys=True))

@contextmanager
def xvfb_manager():
    if wants_xvfb:
        from xvfbwrapper import Xvfb

        vdisplay = Xvfb(width=1280, height=720)
        vdisplay.start()
        try:
            yield vdisplay
        finally:
            vdisplay.stop()
    else:
        yield

def start_driver():
    opts = Options()
    opts.add_extension(build_crx())
    opts.add_experimental_option("prefs", {"profile.block_third_party_cookies": False})
    opts.add_argument('--dns-prefetch-disable')
    opts.binary_location = unix_which(browser_name)
    return webdriver.Chrome(chrome_options=opts)

'''
DATA DUMPERS

To dump some new piece of data, add a function here, with the signature
(selenium_driver, output_dict), inside your function, insert the data into the
output_dict. Then add your function in dump_data.
'''
def get_debug_log(driver, out):
    driver.get(background_url)
    out['debug_log'] = driver.execute_script('return chrome.extension.getBackgroundPage().badger.debugLog.output();')

def get_sc_log(driver, out):
    driver.get(background_url)
    out['sc_log'] = driver.execute_script('return chrome.extension.getBackgroundPage().badger.superCookieLog.output();')

def get_mem_usage(driver, out):
    driver.get('chrome://system/')
    btn = driver.find_element_by_css_selector('#mem_usage-value-btn')
    btn.click()
    out['mem_usage'] = driver.find_element_by_css_selector('#mem_usage-value').text
    
def get_badger_data(driver, out):
    driver.get(background_url)
    out['badger_data'] = dict()
    for storage in storages:
        script = 'return badger.storage.%s.getItemClones();' % storage
        out['badger_data'][storage] = driver.execute_script(script)
    return out

def dump_data(driver):
    data = dict()
    get_debug_log(driver, data)
    get_sc_log(driver, data)
    get_mem_usage(driver, data)
    get_badger_data(driver, data)
    return data

def timeout_workaround(driver):
    '''
    Selenium has a bug where a tab that raises a timeout exception can't
    recover gracefully. So we kill the tab and make a new one.
    '''
    driver.close()  # kill the broken site
    driver.switch_to_window(driver.window_handles.pop())
    before = set(driver.window_handles)
    driver.execute_script('window.open()')
    driver.switch_to_window((set(driver.window_handles) ^ before).pop())
    return driver

def crawl(timeout=7, n_urls=len(urls), start=0):
    '''
    crawl over the websites in the `urls` variable
    '''
    print('starting new crawl with timeout %s n_urls %s start %s' % (timeout, n_urls, start))
    with xvfb_manager():
        driver = start_driver()
        driver.set_page_load_timeout(timeout)
        driver.set_script_timeout(timeout)

        for url in urls[start:start+n_urls]:
            try:
                print('visiting %s' % url)
                driver.get(url)
                sleep(timeout)
            except TimeoutException as e:
                print('timeout on %s ' % url)
                driver = timeout_workaround(driver)
                continue
        data = dump_data(driver)
        driver.quit()
        return data


if __name__ == '__main__':
    import sys
    args = [3, 50, 0]
    for i, v in enumerate(sys.argv[1:]):
        args[i] = int(v)
    data = crawl(*args)
    branch = get_git_branch()
    hash_ = get_git_hash()
    out_file = os.environ.get('OUT_FILE', '%s.%s.results.json' % (branch, hash_))
    save_json(out_file, data)
