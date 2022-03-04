import glob

from pathlib import Path
from behave import *
from subprocess import run


CMD = "styled_markdown"


@given("there are no previously generated outputs")
def step_impl(context):
    for file in glob.glob("*.html"):
        Path(file).unlink()


@given("I have the command in the path")
def step_impl(context):
    from shutil import which

    assert which(CMD) is not None, f"{CMD} is not a runnable command"


@when("I run the command without arguments")
def step_impl(context):

    context.result = run([CMD], text=True, capture_output=True)
    print(context.result)
    assert "Command was run"


@then("the script exits with error code 2")
def step_impl(context):
    assert (
        context.result.returncode == 2
    ), f"return code was {context.result.returncode} instead of 2"


@then("usage")
def step_impl(context):
    assert (
        context.result.stdout == ""
    ), f"stdout should have been empty, instead it is {context.result.stdout}"
    assert context.result.stderr != "", "stderr should not be an empty string"


@given("I have a non existant file path")
def step_impl(context):
    context.args = "asdqwdasdasqwasdasdasd"
    path = Path(context.args)
    assert not path.is_file(), f"expected file '{path}' not to exist"


@when("I pass it as argument to the command")
def step_impl(context):
    context.result = run([CMD, context.args], text=True, capture_output=True)


@then("the script exits with error code")
def step_impl(context):
    assert context.result.returncode != 0, "expected return code not to 0, but it was"


@given("I have an existing file path")
def step_impl(context):
    context.args = "./features/fixtures/single.md"
    path = Path(context.args)
    assert path.is_file(), f"expected file '{context.args}' to exist"


@then("the script exits with success code")
def step_impl(context):
    assert (
        context.result.returncode == 0
    ), f"expected return code to be 0, was {context.result.returncode}"


@then("an HTML string")
def step_impl(context):
    actual = context.result.stdout
    assert (
        actual != "" and "</" in actual
    ), f"expected result to be an HTML string, was {actual}"


@given("I have {md_source} with markdown")
def step_impl(context, md_source):
    context.args = Path(f"./features/fixtures/{md_source}")
    assert context.args.is_file(), f"expected file '{context.args}' to exist"


@when("I run the command")
def step_impl(context):
    context.result = run([CMD, context.args], text=True, capture_output=True)


@then("I get html matching {html_filename}")
def step_impl(context, html_filename):
    expected_html_path = Path(f"./features/fixtures/{html_filename}")
    expected_html = open(expected_html_path, "r").read().strip()
    actual_html = context.result.stdout.strip()

    assert (
        expected_html == actual_html
    ), f"""html don't match:
    EXPECTED:
    {expected_html}
    ---------
    ACTUAL:
    {actual_html}
    """
