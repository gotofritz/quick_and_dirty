#!/usr/bin/env ruby


# A quick and dirty script I put together to process some scraped HTML files
#
# I had a folder full of similar files (consistent structure, all from a CMS) - this is hardcoded in the script
# I needed to extract a section for each and append those section into a text file
# but orderd by the content of a line (the postcode)
#
# usage: ruby collect_html_fragments.rb > a_text_file.txt
class FileSorter
  attr_accessor :files
  attr_accessor :start_string
  attr_accessor :end_string

  # takes the string that start and end the section as arguments
  def initialize(start_string, end_string)
    @files = []
    @start_string = start_string
    @end_string = end_string
  end

  # finds the postcode and adds combo of postcode + filename as
  # hash into an array
  def  extract_postcode file_path
    File.foreach(file_path).with_index { |line, line_num|

      if line.include? '&nbsp;Berlin'
        @files.push( { :postcode => line[0, 5], :file_path => file_path } )
        break
      end
    }
  end

  # sorts array by postcode and returns it
  def dump
    @files.sort_by! { |hsh| hsh[:postcode] }
    return @files
  end

  # extracts required section from HTML file and prints it to STDOUT
  def process_file file_path
    has_started = false
    has_finished = false

    File.foreach(file_path).with_index { |line, line_num|

      if !has_started and line.include? start_string
        has_started = true
      end

      if has_started

        if line.include? end_string
          break

        else
          puts "#{line}"
        end

      end
    }
    puts "</div>\n\n<hr>\n\n"
  end
end


## MAIN

file_sorter = FileSorter.new '<div class="schnellsuche">', '<!-- ********  BEWERTUNG   *********  -->'
Dir.glob("pages/*.html").each do|file|
  file_sorter.extract_postcode file
end

file_sorter.dump.each do|file_object|
  file_sorter.process_file file_object[:file_path]
end


puts "done"