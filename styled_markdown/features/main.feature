Feature: Styled Markdown
  It takes some markdown and returns some formatted HTML

  Background: Cleanup
      Given there are no previously generated outputs

  Scenario: Expects cli arguments
      Given I have the command in the path
       When I run the command without arguments
       Then the script exits with error code 2
        And usage

  Scenario: Fails if cli argument is not found as a path
      Given I have a non existant file path
       When I pass it as argument to the command
       Then the script exits with error code

  Scenario: Outputs a string if single path is found
      Given I have an existing file path
       When I pass it as argument to the command
       Then the script exits with success code
        And an HTML string

  Scenario Outline: Generates styled HTML from markdown
      Given I have <source_file> with markdown
       When I run the command
       Then I get html matching <output_file>

  Examples: Consumer Electronics
    | source_file  | output_file |
    | single.md    | single.html |

