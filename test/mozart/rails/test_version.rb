require 'minitest_helper'

class Mozart::Rails::TestVersion < MiniTest::Unit::TestCase
  def test_version_exists
    refute_nil Mozart::Rails::VERSION
  end

  def test_version_matches_pattern
    assert_match(/\d\.\d+\.\d/, Mozart::Rails::VERSION)
  end

  def test_mozart_version_exists
    refute_nil Mozart::Rails::MOZART_VERSION
  end

  def test_mozart_version_matches_pattern
    assert_match(/\d\.\d+\.\d/, Mozart::Rails::MOZART_VERSION)
  end
end
