"""
DISCLAIMER: this is provided for educataional purposes only. Use at your
own risk

Removes duplicate videos from youtube playlists

Usage:
    > python delete_duplicates.py playlistid_1 playlistid_2 ... playlistid_n
"""

import sys
import os
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google_auth_oauthlib.flow import InstalledAppFlow

MAX_RESULTS = 50
LABEL_QUOTA_EXCEEDED = "quotaExceeded"

# This scope allows for full read/write
# access to the authenticated user's account
# and requires requests to use an SSL connection.
SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"]
API_SERVICE_NAME = "youtube"
API_VERSION = "v3"
CLIENT_SECRETS_FILE = "client_secret.json"


if len(sys.argv) == 1:
    print("You need to pass a space serataed list of playlist IDs as argument")
    exit()


def get_authenticated_service():
    """straight from the YouTube API documentation"""
    flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRETS_FILE, SCOPES)
    credentials = flow.run_console()
    return build(API_SERVICE_NAME, API_VERSION, credentials=credentials)


def delete_video_and_maybe_stop(client, playlist_item_id) -> bool:
    """return true if it should stop, false otherwise"""
    try:
        print(f"-> Deleting {playlist_item_id}")
        (client.playlistItems().delete(id=playlist_item_id)).execute()
        return False
    except HttpError as e:
        if e.error_details[0]["reason"] == LABEL_QUOTA_EXCEEDED:  # type: ignore
            print(f">>>> Quota exceeded - that was it for today, tray again tomorrow!")
            return True
        else:
            print(f">>>> ERROR {e.error_details[0]['message']}")
            return False


def get_vides_to_delete_for_playlist_and_maybe_stop(client, playlist_id):
    """return a tuple: true if it should stop, false otherwise; and a list of video ids"""
    videos_already_done = []
    videos_to_delete = []
    page_token = ""
    should_stop = False
    try:
        while True:
            response = (
                client.playlistItems()
                .list(
                    part="snippet,contentDetails",
                    playlistId=playlist_id,
                    pageToken=page_token,
                    maxResults=MAX_RESULTS,
                )
                .execute()
            )
            print(f"page_token: {page_token}, playlistId: {playlist_id}")
            # print(json.dumps(response, indent=2))
            for item in response["items"]:

                if item["contentDetails"]["videoId"] in videos_already_done:
                    videos_to_delete.append(item["id"])
                    print(f"found a duplicate: {item['snippet']['title']}")
                else:
                    videos_already_done.append(item["contentDetails"]["videoId"])
            if not "nextPageToken" in response:
                print("that was the last page")
                break
            page_token = response["nextPageToken"]
    except HttpError as e:
        if e.error_details[0]["reason"] == LABEL_QUOTA_EXCEEDED:  # type: ignore
            print(f">>>> Quota exceeded that was it for today, tray again tomorrow!")
            should_stop = True
        else:
            print(f">>>> ERROR {e.error_details[0]['message']}")
    return (should_stop, videos_to_delete)


def main(client):
    for playlist_id in sys.argv[1:]:
        should_stop, videos_to_delete = get_vides_to_delete_for_playlist_and_maybe_stop(
            client, playlist_id
        )
        if should_stop:
            break
        deleted = 0
        for playlist_item_id in videos_to_delete:
            should_break = delete_video_and_maybe_stop(client, playlist_item_id)
            if should_break:
                break
            deleted += 1
        print(
            f"deleted {deleted} videos out of {len(videos_to_delete)} for playlist {playlist_id}"
        )


if __name__ == "__main__":
    # When running locally, disable OAuthlib's
    # HTTPs verification. When running in production
    # * do not * leave this option enabled.
    os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
    client = get_authenticated_service()
    main(client)
    print("DONE")
