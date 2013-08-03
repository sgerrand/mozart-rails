require 'minitest_helper'

class TestMozart_Rails < MiniTest::Unit::TestCase
  def test_gem_root_constant_exists
    refute_nil Mozart::Rails::GEM_ROOT
  end

  def test_gem_root_constant_matches_expectation
    assert_match(File.expand_path('../../', __FILE__),
                 Mozart::Rails::GEM_ROOT)
  end

  def test_gem_root_path_exists
    assert File.exists?(Mozart::Rails::GEM_ROOT)
    assert File.directory?(Mozart::Rails::GEM_ROOT)
  end

end
