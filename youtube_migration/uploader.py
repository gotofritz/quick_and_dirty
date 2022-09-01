import pandas as pd
from datetime import datetime
from pathlib import Path
import os
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google_auth_oauthlib.flow import InstalledAppFlow

DATA_DIR = Path("./data")
FILE_STEM = "data.csv"
COL_VIDEO_ID = "Video ID"
COL_STATUS = "Status"
COL_PLAYLIST_ID = "Playlist ID"
LABEL_DONE = "done"
LABEL_404 = "videoNotFound"
LABEL_BLANK = ""
LABEL_QUOTA_EXCEEDED = "quotaExceeded"

# This scope allows for full read/write
# access to the authenticated user's account
# and requires requests to use an SSL connection.
SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"]
API_SERVICE_NAME = "youtube"
API_VERSION = "v3"
CLIENT_SECRETS_FILE = "client_secret.json"


def get_authenticated_service():
    """straight from the YouTube API documentation"""
    flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRETS_FILE, SCOPES)
    credentials = flow.run_console()
    return build(API_SERVICE_NAME, API_VERSION, credentials=credentials)


def pick_latest_file(dir: Path) -> Path:
    """assume that all files have a timestamp in the name, and hence the
    latest is the last one
    """
    all_csvs = sorted(DATA_DIR.glob("*.csv"))
    latest_csv = all_csvs.pop()
    print(f"opening {latest_csv}")
    return latest_csv


def with_timestamp(stem: str) -> str:
    """prepend a timestamp to a string. Typically used for filenames"""
    dt = datetime.now()
    dt_string = dt.strftime("%Y%m%dT%H%M%S")
    return dt_string + "_" + stem


def video_is_already_in_playlist(client, video_id: str, playlist_id: str):
    try:
        print(f"-> Searching whether {video_id} is already in {playlist_id}")
        response = (
            client.playlistItems()
            .list(
                part="snippet, contentDetails",
                playlistId=playlist_id,
                videoId=video_id,
            )
            .execute()
        )
        if len(response["items"]) > 0:
            print("... yes it is, doing next")
            return (True, LABEL_DONE)
    except HttpError as e:
        if e.error_details[0]["reason"] == "videoNotFound":  # type: ignore
            print(f">>>> Are you sure about this video? ID not found {video_id}")
        else:
            print(
                ">>>> ERROR LOOKING FOR VIDEO IN PLAYLIST"
                f"{e.error_details[0]['message']}"
            )  # type: ignore
        return (True, e.error_details[0]["reason"])
    return (False, None)


def add_another_video_to_playlist(client, video_id: str, playlist_id: str):
    try:
        print(f"-> Adding {video_id} to {playlist_id}")
        response = (
            client.playlistItems()
            .insert(
                part="snippet, contentDetails",
                body={
                    "contentDetails": {"videoId": video_id},
                    "snippet": {
                        "playlistId": playlist_id,
                        "resourceId": {
                            "kind": "youtube#video",
                            "videoId": video_id,
                        },
                    },
                },
            )
            .execute()
        )
        print(
            f" + {response['snippet']['title']} / "
            f"{response['snippet']['position']} in playlist"
        )
        return (False, LABEL_DONE)
    except HttpError as e:
        if e.error_details[0]["reason"] == LABEL_QUOTA_EXCEEDED:  # type: ignore
            print(f">>>> Quota exceeded when trying to add {video_id}")
            return (True, LABEL_BLANK)
        processed_df.at[row.Index, COL_STATUS] = e.error_details[0]["reason"]  # type: ignore
        print(f">>>> ERROR {e.error_details[0]['message']}")  # type: ignore
        return (False, e.error_details[0]["reason"])


def partly_processed_csv(client, source_df: pd.DataFrame) -> pd.DataFrame:
    processed_df = source_df.copy()
    for row in processed_df.itertuples():
        data = processed_df.loc[row.Index, [COL_VIDEO_ID, COL_STATUS, COL_PLAYLIST_ID]]
        video_id, status, playlist_id = data.values
        if status in [LABEL_DONE, LABEL_404]:
            continue

        should_skip, reason = video_is_already_in_playlist(
            client, video_id=video_id, playlist_id=playlist_id
        )
        if should_skip:
            processed_df.at[row.Index, COL_STATUS] = reason
            continue

        should_stop, status = add_another_video_to_playlist(
            client, video_id=video_id, playlist_id=playlist_id
        )
        processed_df.at[row.Index, COL_STATUS] = status
        if should_stop:
            return processed_df

    return processed_df


def main(client):
    source_file = pick_latest_file(DATA_DIR)
    source_df = pd.read_csv(source_file)
    processed_df = partly_processed_csv(client, source_df)
    latest_file = with_timestamp(FILE_STEM)
    processed_df.to_csv(DATA_DIR / latest_file, index=False)


if __name__ == "__main__":
    # When running locally, disable OAuthlib's
    # HTTPs verification. When running in production
    # * do not * leave this option enabled.
    os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
    client = get_authenticated_service()
    main(client)
    print("DONE")
