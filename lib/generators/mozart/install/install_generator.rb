require 'rails'

# Supply generator for Rails 3.0.x or if asset pipeline is not enabled
if ::Rails.version < "3.1" || !::Rails.application.config.assets.enabled
  module Mozart
    module Generators
      class InstallGenerator < ::Rails::Generators::Base

        desc "This generator installs Mozart #{Mozart::Rails::MOZART_VERSION}"
        source_root File.expand_path('../../../../../vendor/assets/javascripts/mozart/vendor/scripts', __FILE__)

        def copy_mozart
          say_status("copying", "Mozart (#{Mozart::Rails::MOZART_VERSION})", :green)
          copy_file "mozart.js", "public/javascripts/mozart.js"
          copy_file "handlebars.runtime.js", "public/javascripts/handlebars.runtime.js"
          copy_file "jquery.js", "public/javascripts/jquery.js"
          copy_file "underscore.js", "public/javascripts/underscore.js"
        end

      end
    end
  end
else
  module Mozart
    module Generators
      class InstallGenerator < ::Rails::Generators::Base
        desc "Just show instructions so people will know what to do when mistakenly using generator for Rails 3.1 apps"

        def do_nothing
          say_status("deprecated", "You are using Rails 3.1 with the asset pipeline enabled, so this generator is not needed.")
          say_status("", "The necessary files are already in your asset pipeline.")
          say_status("", "Just add the following to your app/assets/javascripts/application.js")
          say_status("", "//= require mozart-all")
          say_status("", "If you do not want the asset pipeline enabled, you may turn it off in application.rb and re-run this generator.")
          # ok, nothing
        end
      end
    end
  end
end
