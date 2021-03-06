require 'minitest_helper'

class Mozart::Rails::TestAssets < MiniTest::Unit::TestCase
  def test_javascript_urls_exists
    refute_nil Mozart::Rails::JAVASCRIPT_URLS
  end

  def test_javascript_urls_contains_mozart_cdn_urls
    prefix = 'http://cdn.bigcommerce.com/mozart/' + Mozart::Rails::MOZART_VERSION
    assert Mozart::Rails::JAVASCRIPT_URLS.include? :mozart
    ['/mozart.js', '/mozart.min.js'].each do |file|
      assert Mozart::Rails::JAVASCRIPT_URLS[:mozart].include? prefix + file
    end
  end

  def test_vendor_path_exists
    refute_nil Mozart::Rails::VENDOR_PATH
  end

  def test_version_matches_pattern
    assert_match('vendor/assets/javascripts', Mozart::Rails::VENDOR_PATH)
  end
end
