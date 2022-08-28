from pathlib import Path
import pandas as pd
from datetime import datetime

SOURCE_DIR = Path("./playlists")
TARGET_DIR = Path("./data")


def with_timestamp(stem: str) -> str:
    dt = datetime.now()
    dt_string = dt.strftime("%Y%m%dT%H%M%S")
    return dt_string + "_" + stem


def get_csv_files():
    csvs = []
    for p in SOURCE_DIR.glob("*.csv"):
        print(f"reading {p.name}")
        playlist = Path(p.name).stem
        df = pd.read_csv(SOURCE_DIR / p.name, skiprows=3)
        df["Status"] = pd.Series(["" for x in range(len(df.index))])
        df["Playlist ID"] = pd.Series([playlist for x in range(len(df.index))])
        csvs.append(df)
    return pd.concat(csvs)


def main():
    concatenated_df = get_csv_files()
    destination_csv = TARGET_DIR / with_timestamp("data.csv")
    concatenated_df.to_csv(destination_csv, index=False)
    print(f"Created {destination_csv}")


if __name__ == "__main__":
    main()
