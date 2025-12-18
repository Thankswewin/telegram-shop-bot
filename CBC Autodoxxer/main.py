import requests
import tls_client
import json
import collections
collections.Callable = collections.abc.Callable
from bs4 import BeautifulSoup
import math
import random
from concurrent.futures import ThreadPoolExecutor
import logging
import time
from requests.packages.urllib3.exceptions import InsecureRequestWarning

MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 1

log_filename = "logfile.log"
log_level = logging.INFO

logger = logging.getLogger()
logger.setLevel(log_level)

file_handler = logging.FileHandler(log_filename)

stream_handler = logging.StreamHandler()

formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s", datefmt="%Y-%m-%d %H:%M:%S")

file_handler.setFormatter(formatter)
stream_handler.setFormatter(formatter)

logger.addHandler(file_handler)
logger.addHandler(stream_handler)

requests.packages.urllib3.disable_warnings(category=InsecureRequestWarning)

def load_all_proxies() -> list[str]:
    with open('proxies.txt') as f:
        proxy_file = f.read().splitlines()
    all_proxies = []
    for proxy in proxy_file:
        try:
            proxy = f"http://{proxy}"
            all_proxies.append(proxy)
        except:
            pass
    return all_proxies

proxies = load_all_proxies()

def get_proxy():
    return random.choice(proxies)

def get_details(session, email, retries=MAX_RETRIES):
    headers = {
      'host': 'www.cyberbackgroundchecks.com',
      'connection': 'keep-alive',
      'sec-ch-ua': '"Google Chrome";v="117", "Not;A=Brand";v="8", "Chromium";v="117"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'upgrade-insecure-requests': '1',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-user': '?1',
      'sec-fetch-dest': 'document',
      'referer': 'https://www.cyberbackgroundchecks.com/email',
      'accept-encoding': 'gzip, deflate, br',
      'accept-language': 'en-US,en;q=0.9'
    }

    try:
        response = session.get(f'https://www.cyberbackgroundchecks.com/email/{email.replace("@", "_.")}', headers=headers)

        if response.status_code == 200 and '[{"@context":"http://schema.org","@type":"Person"' in response.text:
            details = json.loads('[{"@context":"http://schema.org","@type":"Person"' +
                                response.text.split('[{"@context":"http://schema.org","@type":"Person"')[1].split('\n')[0])[0]

            return response, details

        elif response.status_code == 403 and retries > 0:
            #logging.warning(f"{email}: Received 403 status code. Retrying... {retries} retries left.")
            new_session = tls_client.Session(client_identifier="Firefox110", random_tls_extension_order=True)
            new_proxy = get_proxy()
            new_session.proxies = {'http': new_proxy, 'https': new_proxy}
            return get_details(new_session, email, retries - 1)

        elif response.status_code == 503 and retries > 0:
            #logging.warning(f"{email}: Received 503 status code. Retrying... {retries} retries left.")
            new_session = tls_client.Session(client_identifier="Firefox110", random_tls_extension_order=True)
            new_proxy = get_proxy()
            new_session.proxies = {'http': new_proxy, 'https': new_proxy}
            return get_details(new_session, email, retries - 1)

        else:
            return None, None

    except requests.exceptions.RequestException as e:
        if retries > 0:
            logging.warning(f"{email}: Network error occurred. Retrying... {retries} retries left. Error: {str(e)}")
            new_session = tls_client.Session(client_identifier="Firefox110", random_tls_extension_order=True)
            new_proxy = get_proxy()
            new_session.proxies = {'http': new_proxy, 'https': new_proxy}
            return get_details(new_session, email, retries - 1)
        else:
            logging.error(f"{email}: Unable to process email: {str(e)}")
            return None, None

def get_zestimate(session, address):
    retries = 0
    while retries < MAX_RETRIES:
        try:
            url = 'https://www.zillowstatic.com/autocomplete/v3/suggestions/'
            params = {
                'q': address,
                'resultTypes': 'allAddress',
                'resultCount': '1',
            }

            headers = {
                'sec-ch-ua': '"Google Chrome";v="117", "Not;A=Brand";v="8", "Chromium";v="117"',
                'Accept': 'application/json, text/plain, */*',
                'Referer': 'https://www.zillow.com/how-much-is-my-home-worth/',
                'sec-ch-ua-mobile': '?0',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
                'sec-ch-ua-platform': '"Windows"',
            }

            response = session.get(url, params=params, headers=headers)

            if response.status_code == 200:
                data = response.json()
                zpid = data['results'][0]['metaData']['zpid']
                return zpid
            else:
                retries += 1
                #logging.warning(f"Received non-200 status code: {response.status_code}. Retrying... ({retries}/{MAX_RETRIES})")
                time.sleep(RETRY_DELAY_SECONDS)
        except Exception as e:
            retries += 1
            #logging.warning(f"An error occurred: {str(e)}. Retrying... ({retries}/{MAX_RETRIES})")
            time.sleep(RETRY_DELAY_SECONDS)

    logging.error("Unable to fetch Zestimate.")
    return None

def get_zestimate_data(session, zpid):
    retries = 0
    while retries < MAX_RETRIES:
        try:
            json_data = {
                'operationName': 'HowMuchIsMyHomeWorthReviewQuery',
                'variables': {
                    'zpid': zpid,
                },
                'query': 'query HowMuchIsMyHomeWorthReviewQuery($zpid: ID!) {\n  property(zpid: $zpid) {\n    streetAddress\n    city\n    state\n    zipcode\n    bedrooms\n    bathrooms\n    livingArea\n    zestimate\n    homeStatus\n    photos(size: XL) {\n      url\n      __typename\n    }\n    ...OmpHomeWorthUpsell_property\n    isConfirmedClaimedByCurrentSignedInUser\n    isVerifiedClaimedByCurrentSignedInUser\n    ...UARequiredPropertyDimensions_property\n    ...ContactAgentForm_property\n    ...HomeInfo_property\n    __typename\n  }\n  viewer {\n    ...ContactAgentForm_viewer\n    __typename\n  }\n  abTests {\n    ...OmpHomeWorthUpsell_abTests\n    ...UARequiredPropertyDimensions_abTests\n    ...ContactAgentForm_abTests\n    __typename\n  }\n}\n\nfragment OmpHomeWorthUpsell_property on Property {\n  zpid\n  onsiteMessage(placementNames: ["HMIMHWTopSlot"]) {\n    ...onsiteMessage_fragment\n    __typename\n  }\n  __typename\n}\n\nfragment onsiteMessage_fragment on OnsiteMessageResultType {\n  eventId\n  decisionContext\n  messages {\n    skipDisplayReason\n    shouldDisplay\n    isGlobalHoldout\n    isPlacementHoldout\n    placementName\n    testPhase\n    bucket\n    placementId\n    passThrottle\n    lastModified\n    eventId\n    decisionContext\n    selectedTreatment {\n      id\n      name\n      component\n      status\n      renderingProps\n      lastModified\n      __typename\n    }\n    qualifiedTreatments {\n      id\n      name\n      status\n      lastModified\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment OmpHomeWorthUpsell_abTests on ABTests {\n  HMIMHW_ZO_NFS_UPSELL_ONSITE_MESSAGING: abTest(\n    trial: "HMIMHW_ZO_NFS_UPSELL_ONSITE_MESSAGING"\n  )\n  __typename\n}\n\nfragment UARequiredPropertyDimensions_property on Property {\n  currency\n  featuredListingTypeDimension\n  hasPublicVideo\n  hdpTypeDimension\n  listingTypeDimension\n  price\n  propertyTypeDimension\n  standingOffer {\n    isStandingOfferEligible\n    __typename\n  }\n  zpid\n  isZillowOwned\n  zillowOfferMarket {\n    legacyName\n    __typename\n  }\n  ...ShouldShowVideo_property\n  __typename\n}\n\nfragment ShouldShowVideo_property on Property {\n  homeStatus\n  isZillowOwned\n  hasPublicVideo\n  primaryPublicVideo {\n    sources {\n      src\n      __typename\n    }\n    __typename\n  }\n  richMediaVideos {\n    mp4Url\n    hlsUrl\n    __typename\n  }\n  __typename\n}\n\nfragment UARequiredPropertyDimensions_abTests on ABTests {\n  ZO_HDP_HOUR_ONE_VIDEO: abTest(trial: "ZO_HDP_HOUR_ONE_VIDEO")\n  __typename\n}\n\nfragment ContactAgentForm_property on Property {\n  streetAddress\n  state\n  city\n  zipcode\n  zpid\n  homeStatus\n  homeType\n  zestimate\n  homeType\n  isInstantOfferEnabled\n  zillowOfferMarket {\n    name\n    code\n    __typename\n  }\n  __typename\n}\n\nfragment ContactAgentForm_viewer on Viewer {\n  name\n  email\n  zuid\n  __typename\n}\n\nfragment ContactAgentForm_abTests on ABTests {\n  SHOW_PL_LEAD_FORM: abTest(trial: "SHOW_PL_LEAD_FORM")\n  __typename\n}\n\nfragment HomeInfo_property on Property {\n  streetAddress\n  city\n  state\n  zipcode\n  bedrooms\n  bathrooms\n  livingArea\n  homeStatus\n  homeType\n  contingentListingType\n  photos(size: XL) {\n    url\n    __typename\n  }\n  listing_sub_type {\n    is_newHome\n    is_FSBO\n    is_bankOwned\n    is_foreclosure\n    is_forAuction\n    is_comingSoon\n    __typename\n  }\n  __typename\n}\n',
            }

            zheaders = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-CA,en-US;q=0.7,en;q=0.3',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Sec-GPC': '1',
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache',
            }

            response = session.post('https://www.zillow.com/graphql/', headers=zheaders, json=json_data)

            if response.status_code == 200:
                data = response.json()
                return data
            else:
                retries += 1
                #logging.warning(f"Received non-200 status code: {response.status_code}. Retrying... ({retries}/{MAX_RETRIES})")
                time.sleep(RETRY_DELAY_SECONDS)
        except Exception as e:
            retries += 1
            #logging.warning(f"An error occurred: {str(e)}. Retrying... ({retries}/{MAX_RETRIES})")
            time.sleep(RETRY_DELAY_SECONDS)

    logging.error("Max retries exceeded. Unable to fetch data.")
    return None

def process_email(email):
    logging.info(f"{email}: Trying to retrieve")
    session = tls_client.Session(client_identifier="Firefox110", random_tls_extension_order=True)
    selected_proxy = get_proxy()
    session.proxies = {'http': selected_proxy, 'https': selected_proxy}
    response, details = get_details(session, email)

    fullname = ''
    phone_numbers = []
    age = ''
    score = ''
    address = ''

    if details:
        fullname = details['name']
        other_phone_numbers = details.get('telephone', [])
        if isinstance(other_phone_numbers, str):
            phone_numbers.append(f'"{other_phone_numbers}"')
        else:
            phone_numbers.extend([f'"{number}"' for number in other_phone_numbers])
        soup = BeautifulSoup(response.text, 'html.parser')
        age_span = soup.find('span', class_='age')
        age = age_span.get_text() if age_span else ''

        for index, line in enumerate(zipdb):
            if details['address'][0]['postalCode'] in line.split(',')[0]:
                score = math.floor(100 - (0.00301932367 * index))
                break

        address = f"{details['address'][0]['streetAddress']} {details['address'][0]['addressLocality']} {details['address'][0]['addressRegion']} {details['address'][0]['postalCode']}"

        zpid = get_zestimate(session, address)

        if zpid:
            zestimate_data = get_zestimate_data(session, zpid)
            zestimate = zestimate_data['data']['property']['zestimate']
        else:
            zestimate = ''

        output = f"{email} | \"{fullname}\" | [{', '.join(phone_numbers)}] | Wealth Score: {score} | Zestimate: ${zestimate} | {address} | Age: {age}"
        with open("output.txt", "a") as output_file:
            output_file.write(f"{output}\n")
        logging.info(output)
    else:
        logging.info(f"{email}: Failed to retrieve information")

def main():
    with open('emails.txt', 'r') as email_file:
        emails = email_file.read().splitlines()

    with ThreadPoolExecutor(max_workers=50) as executor:
        futures = [executor.submit(process_email_with_retry, email) for email in emails]

    for future in futures:
        try:
            future.result()
        except Exception as e:
            logging.error(f"Error processing email: {str(e)}")

def process_email_with_retry(email, max_retries=3):
    current_retry = 0

    while current_retry < max_retries:
        try:
            process_email(email)
            break
        except Exception as e:
            current_retry += 1
            #logging.warning(f"Retrying email processing for '{email}'. Retry attempt: {current_retry}/{max_retries}. Error: {str(e)}")
            time.sleep(RETRY_DELAY_SECONDS)

    if current_retry == max_retries:
        logging.error(f"Max retries exceeded. Unable to process email: {email}")

if __name__ == "__main__":
    zipdb = open('zipdb.csv', 'r', encoding='utf-8', errors='replace').readlines()
    main()