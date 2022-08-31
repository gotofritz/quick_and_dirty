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
LABEL_QUOTA_EXCEEDED = "quotaExceeded"
CLIENT_SECRETS_FILE = "client_secret.json"

# This scope allows for full read/write
# access to the authenticated user's account
# and requires requests to use an SSL connection.
SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"]
API_SERVICE_NAME = "youtube"
API_VERSION = "v3"


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


def partly_processed_csv(client, source_df: pd.DataFrame) -> pd.DataFrame:
    processed_df = source_df.copy()
    for row in processed_df.itertuples():
        data = processed_df.loc[row.Index, [COL_VIDEO_ID, COL_STATUS, COL_PLAYLIST_ID]]
        video_id, status, playlist_id = data.values
        if status in [LABEL_DONE, LABEL_404]:
            continue
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
            processed_df.at[row.Index, COL_STATUS] = LABEL_DONE
        except HttpError as e:
            if e.error_details[0]["reason"] == LABEL_QUOTA_EXCEEDED:  # type: ignore
                print(f">>>> Quota exceeded when trying to add {video_id}")
                return processed_df
            processed_df.at[row.Index, COL_STATUS] = e.error_details[0]["reason"]  # type: ignore
            print(f">>>> ERROR {e.error_details[0]['message']}")  # type: ignore
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
