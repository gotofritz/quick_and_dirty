from pathlib import Path
import shutil
import argparse


def copy_files(files_to_copy, without_source, destination_folder):
    print(without_source)
    for source_path, fragment in zip(files_to_copy, without_source):
        # debug
        # print(source_path)
        # print(fragment)
        # print("-")

        if source_path.is_dir() or source_path.as_posix().endswith(".DS_Store"):
            continue
        destination_path = destination_folder / fragment
        destination_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_path, destination_path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("-s", "--src", help="Path to the source folder")
    parser.add_argument("-d", "--dest", help="Path to the destination folder")
    args = parser.parse_args()

    source_folder = args.src
    destination_folder = Path(args.dest.rstrip("/"))

    if source_folder is None:
        raise ValueError("Missing --src (source folder)")

    if destination_folder is None:
        raise ValueError("Missing --dest (destinatiobn folder)")

    files_to_copy = sorted(list(Path(source_folder).glob("**/*")))
    start = len(source_folder)
    without_source = [f.as_posix()[start:] for f in files_to_copy]
    copy_files(files_to_copy, without_source, destination_folder)


if __name__ == "__main__":
    main()


# if __name__ == "__main__":
# files_to_copy = ["file1.txt", "file2.txt", "file3.txt"]
# source_folder = "/path/to/source/folder"
# destination_folder = "/path/to/destination/folder"

# copy_files(files_to_copy, source_folder, destination_folder)
